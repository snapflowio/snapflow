// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20Permit } from "@openzeppelin-contracts/token/ERC20/extensions/IERC20Permit.sol";
import { Math } from "@openzeppelin-contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin-contracts/utils/math/SafeCast.sol";
import { IERC3009 } from "../interfaces/IERC3009.sol";
import { EscrowHashing } from "../libraries/EscrowHashing.sol";
import { EscrowLimits } from "../libraries/EscrowLimits.sol";
import { Account, DepositCaps } from "../types/EscrowTypes.sol";
import { EscrowCompliance } from "./EscrowCompliance.sol";
import { EscrowPause } from "./EscrowPause.sol";

abstract contract EscrowAccounts is EscrowCompliance, EscrowPause {
    mapping(address account => Account) private _accounts;

    DepositCaps private _depositCaps;

    function deposit(uint256 amount) external nonReentrant {
        _deposit(msg.sender, amount);
    }

    function depositFor(address customer, uint256 amount) external nonReentrant {
        _deposit(customer, amount);
    }

    function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external nonReentrant {
        // slither-disable-next-line reentrancy-events,reentrancy-benign
        try IERC20Permit(address(token)).permit(msg.sender, address(this), amount, deadline, v, r, s) { } catch { }
        _deposit(msg.sender, amount);
    }

    function depositWithAuthorization(
        address payer,
        address customer,
        uint256 amount,
        uint256 relayFee,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 salt,
        bytes calldata signature
    )
        external
        nonReentrant
    {
        if (relayFee > EscrowLimits.MAX_RELAY_FEE) revert RelayFeeTooHigh(relayFee, EscrowLimits.MAX_RELAY_FEE);
        if (amount <= relayFee) revert ZeroAmount();
        uint256 credited = amount - relayFee;
        _creditDeposit(customer, payer, credited);
        _recordTokensIn(credited);
        bytes32 nonce = EscrowHashing.depositNonce(
            address(this), payer, customer, msg.sender, amount, relayFee, validAfter, validBefore, salt
        );
        IERC3009(address(token))
            .receiveWithAuthorization(payer, address(this), amount, validAfter, validBefore, nonce, signature);
        if (relayFee != 0) {
            emit RelayFeePaid(msg.sender, payer, relayFee);
            _forwardTokens(msg.sender, relayFee);
        }
    }

    function requestWithdrawal(uint256 amount) external {
        _requireNotBlocked(msg.sender);
        _debitFree(msg.sender, amount);
        Account storage account = _accounts[msg.sender];
        // forge-lint: disable-next-line(unsafe-typecast)
        uint128 pending = account.pending + uint128(amount);
        uint64 unlockAt = unfrozenTime() + withdrawalDelay;
        account.pending = pending;
        account.unlockAt = unlockAt;
        emit WithdrawalRequested(msg.sender, amount, pending, unlockAt);
    }

    function cancelWithdrawal() external {
        Account storage account = _accounts[msg.sender];
        uint128 pending = account.pending;
        if (pending == 0) revert NoWithdrawalPending(msg.sender);
        account.pending = 0;
        account.unlockAt = 0;
        account.free += pending;
        emit WithdrawalCancelled(msg.sender, pending);
    }

    function completeWithdrawal() external nonReentrant {
        _requireNotBlocked(msg.sender);
        Account storage account = _accounts[msg.sender];
        uint128 pending = account.pending;
        if (pending == 0) revert NoWithdrawalPending(msg.sender);
        uint64 unlockAt = account.unlockAt;
        if (unfrozenTime() < unlockAt) revert WithdrawalLocked(msg.sender, unlockAt);
        account.pending = 0;
        account.unlockAt = 0;
        emit Withdrawn(msg.sender, pending);
        _pushTokens(msg.sender, pending);
    }

    function accountOf(address account) external view returns (Account memory) {
        return _accounts[account];
    }

    function setDepositCaps(DepositCaps calldata caps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setDepositCaps(caps);
    }

    function depositCaps() external view returns (DepositCaps memory) {
        return _depositCaps;
    }

    function maxDepositOf(address customer) external view returns (uint256) {
        return Math.min(_totalDepositRoom(), _accountDepositRoom(customer));
    }

    function availableOf(address customer) public view returns (uint256) {
        Account storage account = _accounts[customer];
        return uint256(account.free) + account.pending;
    }

    function _debitForClaim(address customer, uint128 amount) internal {
        Account storage account = _accounts[customer];
        uint128 free = account.free;
        if (amount <= free) {
            account.free = free - amount;
            return;
        }
        account.free = 0;
        account.pending -= amount - free;
    }

    function _takeAccount(address account) internal returns (uint256 amount) {
        Account storage balances = _accounts[account];
        amount = uint256(balances.free) + balances.pending;
        delete _accounts[account];
    }

    function _creditReleased(address account, uint256 amount) internal override {
        _accounts[account].free += SafeCast.toUint128(amount);
    }

    function _debitFree(address account, uint256 amount) private {
        if (amount == 0) revert ZeroAmount();
        uint128 available = _accounts[account].free;
        if (amount > available) revert InsufficientFreeBalance(account, amount, available);
        // forge-lint: disable-next-line(unsafe-typecast)
        _accounts[account].free = available - uint128(amount);
    }

    function _deposit(address customer, uint256 amount) private {
        _creditDeposit(customer, msg.sender, amount);
        _pullTokens(amount);
    }

    function _creditDeposit(address customer, address payer, uint256 amount) internal whenNotPaused {
        if (customer == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _requireNotBlocked(customer);
        _requireNotBlocked(payer);
        _requireNotBlocked(msg.sender);
        uint256 totalRoom = _totalDepositRoom();
        if (amount > totalRoom) revert TotalDepositCapExceeded(amount, totalRoom);
        uint256 accountRoom = _accountDepositRoom(customer);
        if (amount > accountRoom) revert AccountDepositCapExceeded(customer, amount, accountRoom);
        _accounts[customer].free += SafeCast.toUint128(amount);
        emit Deposited(customer, payer, amount);
    }

    function _setDepositCaps(DepositCaps memory caps) internal {
        _depositCaps = caps;
        emit DepositCapsSet(caps.total, caps.perAccount);
    }

    function _totalDepositRoom() private view returns (uint256) {
        return _room(_depositCaps.total, totalHeld());
    }

    function _accountDepositRoom(address customer) private view returns (uint256) {
        return _room(_depositCaps.perAccount, availableOf(customer));
    }

    function _room(uint256 cap, uint256 used) private pure returns (uint256) {
        if (cap == 0) return type(uint256).max;
        return used >= cap ? 0 : cap - used;
    }
}
