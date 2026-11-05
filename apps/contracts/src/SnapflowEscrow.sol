// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import {
    AccessControlDefaultAdminRules
} from "@openzeppelin-contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin-contracts/token/ERC20/extensions/IERC20Permit.sol";
import { SafeERC20 } from "@openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import { EIP712 } from "@openzeppelin-contracts/utils/cryptography/EIP712.sol";
import { SignatureChecker } from "@openzeppelin-contracts/utils/cryptography/SignatureChecker.sol";
import { Pausable } from "@openzeppelin-contracts/utils/Pausable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin-contracts/utils/ReentrancyGuardTransient.sol";
import { EscrowFeePolicy } from "./abstracts/EscrowFeePolicy.sol";
import { EscrowSessionKeys } from "./abstracts/EscrowSessionKeys.sol";
import { EscrowLimits } from "./libraries/EscrowLimits.sol";
import { VoucherHashing } from "./libraries/VoucherHashing.sol";
import { Channel, SignedVoucher, Voucher, WithdrawalRequest } from "./types/EscrowTypes.sol";

/// @title SnapflowEscrow
/// @notice Holds each customer's USDC until a host claims a voucher the customer (or one of its session keys) signed.
/// Snapflow can never move a customer's balance anywhere but to the customer, the voucher's host or the fee recipient.
contract SnapflowEscrow is
    EscrowFeePolicy,
    EscrowSessionKeys,
    AccessControlDefaultAdminRules,
    EIP712,
    Pausable,
    ReentrancyGuardTransient
{
    using SafeERC20 for IERC20;
    using VoucherHashing for Voucher;

    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    string private constant DOMAIN_NAME = "SnapflowEscrow";
    string private constant DOMAIN_VERSION = "1";

    IERC20 public immutable token;
    uint64 public immutable disputeWindow;

    mapping(address customer => uint256) private _balances;
    // Written through the storage pointer returned by _bindChannel.
    // slither-disable-next-line uninitialized-state
    mapping(bytes32 channelId => Channel) private _channels;
    mapping(address customer => WithdrawalRequest) private _withdrawals;
    mapping(address account => bool) private _blocked;

    constructor(
        IERC20 token_,
        address admin,
        address initialFeeRecipient,
        uint16 initialFeeCapBps,
        uint64 disputeWindow_
    )
        EscrowFeePolicy(initialFeeCapBps, initialFeeRecipient)
        AccessControlDefaultAdminRules(EscrowLimits.ADMIN_TRANSFER_DELAY, admin)
        EIP712(DOMAIN_NAME, DOMAIN_VERSION)
    {
        if (address(token_) == address(0)) revert ZeroAddress();
        if (disputeWindow_ < EscrowLimits.MIN_DISPUTE_WINDOW || disputeWindow_ > EscrowLimits.MAX_DISPUTE_WINDOW) {
            revert DisputeWindowOutOfRange(disputeWindow_);
        }
        token = token_;
        disputeWindow = disputeWindow_;
    }

    modifier notBlocked(address account) {
        if (_blocked[account]) revert AccountBlocked(account);
        _;
    }

    // ---------------------------------------------------------------- deposits

    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    function depositFor(address customer, uint256 amount) external {
        _deposit(customer, amount);
    }

    /// @dev The permit is wrapped in try/catch so a front-run permit cannot block the deposit that follows it.
    function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        // The permit only sets this contract's allowance; the deposit that follows is reentrancy guarded.
        // slither-disable-next-line reentrancy-events,reentrancy-benign
        try IERC20Permit(address(token)).permit(msg.sender, address(this), amount, deadline, v, r, s) { } catch { }
        _deposit(msg.sender, amount);
    }

    function _deposit(
        address customer,
        uint256 amount
    )
        private
        nonReentrant
        whenNotPaused
        notBlocked(customer)
        notBlocked(msg.sender)
    {
        if (customer == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _balances[customer] += amount;
        // The only earlier external call is the optional permit, which cannot re-enter this guarded function.
        // forge-lint: disable-next-line(reentrancy-events)
        emit Deposited(customer, msg.sender, amount);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    // ---------------------------------------------------------------- session keys

    function setSessionKey(
        address key,
        uint128 spendCap,
        uint128 hourlyCap,
        uint64 expiry
    )
        external
        notBlocked(msg.sender)
    {
        _setSessionKey(msg.sender, key, spendCap, hourlyCap, expiry);
    }

    function revokeSessionKey(address key) external {
        _revokeSessionKey(msg.sender, key);
    }

    // ---------------------------------------------------------------- claims

    function claim(SignedVoucher calldata signed) external nonReentrant whenNotPaused {
        _claim(signed);
    }

    function claimBatch(SignedVoucher[] calldata signed) external nonReentrant whenNotPaused {
        if (signed.length == 0) revert EmptyBatch();
        for (uint256 i; i < signed.length; ++i) {
            _claim(signed[i]);
        }
    }

    function _claim(SignedVoucher calldata signed) private {
        Voucher calldata voucher = signed.voucher;
        _requireClaimable(voucher);
        Channel storage channel = _bindChannel(voucher);
        (uint256 hostDelta, uint256 feeDelta, uint256 serviceDelta) = _increases(voucher, channel);
        uint256 total = hostDelta + feeDelta + serviceDelta;
        _authorize(signed, total);
        _debit(voucher.customer, total);
        channel.sequence = voucher.sequence;
        channel.hostClaimed = voucher.hostAmount;
        channel.feeClaimed = voucher.feeAmount;
        channel.serviceClaimed = voucher.serviceAmount;

        // The only earlier external call is the read-only ERC-1271 signature check.
        // forge-lint: disable-next-item(reentrancy-events)
        emit Claimed(
            voucher.channelId, voucher.customer, voucher.host, hostDelta, feeDelta, serviceDelta, voucher.sequence
        );
        if (hostDelta > 0) token.safeTransfer(voucher.host, hostDelta);
        uint256 platformDelta = feeDelta + serviceDelta;
        if (platformDelta > 0) token.safeTransfer(feeRecipient(), platformDelta);
    }

    function _requireClaimable(Voucher calldata voucher) private view {
        if (voucher.expiry < block.timestamp) revert VoucherExpired(voucher.expiry);
        if (_blocked[voucher.customer]) revert AccountBlocked(voucher.customer);
        if (_blocked[voucher.host]) revert AccountBlocked(voucher.host);
    }

    /// @dev What this voucher adds over what the channel has already paid, with the fee checked against the cap.
    function _increases(
        Voucher calldata voucher,
        Channel storage channel
    )
        private
        view
        returns (uint256 hostDelta, uint256 feeDelta, uint256 serviceDelta)
    {
        if (voucher.sequence <= channel.sequence) revert StaleVoucher(voucher.sequence, channel.sequence);
        if (
            voucher.hostAmount < channel.hostClaimed || voucher.feeAmount < channel.feeClaimed
                || voucher.serviceAmount < channel.serviceClaimed
        ) revert AmountDecreased(voucher.channelId);
        hostDelta = voucher.hostAmount - channel.hostClaimed;
        feeDelta = voucher.feeAmount - channel.feeClaimed;
        serviceDelta = voucher.serviceAmount - channel.serviceClaimed;
        uint256 allowedFee = _allowedFee(hostDelta);
        if (feeDelta > allowedFee) revert FeeAboveCap(feeDelta, allowedFee);
        if (hostDelta + feeDelta + serviceDelta == 0) revert ZeroAmount();
    }

    /// @dev Checks the signature and, for a session key, charges `total` against its limits.
    function _authorize(SignedVoucher calldata signed, uint256 total) private {
        Voucher calldata voucher = signed.voucher;
        if (!SignatureChecker.isValidSignatureNow(signed.signer, voucherDigest(voucher), signed.signature)) {
            revert InvalidSignature(signed.signer);
        }
        if (signed.signer != voucher.customer) _consumeSessionAllowance(voucher.customer, signed.signer, total);
    }

    function _debit(address customer, uint256 amount) private {
        uint256 available = _balances[customer];
        if (amount > available) revert InsufficientBalance(customer, amount, available);
        _balances[customer] = available - amount;
    }

    /// @dev Binds a channel to its customer and host on first claim; later vouchers must name the same parties.
    function _bindChannel(Voucher calldata voucher) private returns (Channel storage channel) {
        channel = _channels[voucher.channelId];
        if (channel.customer == address(0)) {
            if (voucher.customer == address(0) || voucher.host == address(0)) revert ZeroAddress();
            channel.customer = voucher.customer;
            channel.host = voucher.host;
        } else if (channel.customer != voucher.customer || channel.host != voucher.host) {
            revert ChannelMismatch(voucher.channelId);
        }
    }

    // ---------------------------------------------------------------- withdrawals

    /// @notice Starts the dispute window; hosts can still claim the customer's latest vouchers until it ends.
    function requestWithdrawal(uint256 amount) external notBlocked(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        uint256 available = _balances[msg.sender];
        if (amount > available) revert InsufficientBalance(msg.sender, amount, available);
        // block.timestamp fits uint64 for billions of years.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 readyAt = uint64(block.timestamp) + disputeWindow;
        _withdrawals[msg.sender] = WithdrawalRequest({ amount: amount, readyAt: readyAt });
        emit WithdrawalRequested(msg.sender, amount, readyAt);
    }

    function cancelWithdrawal() external {
        if (_withdrawals[msg.sender].readyAt == 0) revert NoWithdrawalRequested(msg.sender);
        delete _withdrawals[msg.sender];
        emit WithdrawalCancelled(msg.sender);
    }

    /// @notice Works while paused, so a customer can always leave with what hosts have not claimed.
    function withdraw() external nonReentrant notBlocked(msg.sender) {
        WithdrawalRequest memory request = _withdrawals[msg.sender];
        if (request.readyAt == 0) revert NoWithdrawalRequested(msg.sender);
        if (block.timestamp < request.readyAt) revert WithdrawalNotReady(request.readyAt);
        delete _withdrawals[msg.sender];

        uint256 available = _balances[msg.sender];
        uint256 amount = request.amount < available ? request.amount : available;
        _balances[msg.sender] = available - amount;
        emit Withdrawn(msg.sender, amount);
        if (amount > 0) token.safeTransfer(msg.sender, amount);
    }

    // ---------------------------------------------------------------- administration

    function scheduleFeeCap(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _scheduleFeeCap(bps);
    }

    function cancelFeeCapSchedule() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _cancelFeeCapSchedule();
    }

    /// @notice Anyone may apply a fee cap change once its timelock has passed.
    function applyFeeCap() external {
        _applyFeeCap();
    }

    function setFeeRecipient(address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setFeeRecipient(recipient);
    }

    /// @notice Freezes an address after a sanctions match: it can neither deposit, claim, be paid nor withdraw.
    function blockAccount(address account) external onlyRole(COMPLIANCE_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        _blocked[account] = true;
        emit AddressBlocked(account);
    }

    function unblockAccount(address account) external onlyRole(COMPLIANCE_ROLE) {
        _blocked[account] = false;
        emit AddressUnblocked(account);
    }

    /// @notice Stops deposits and claims in an emergency. Withdrawals keep working.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ---------------------------------------------------------------- views

    function balanceOf(address customer) external view returns (uint256) {
        return _balances[customer];
    }

    function channelOf(bytes32 channelId) external view returns (Channel memory) {
        return _channels[channelId];
    }

    function withdrawalOf(address customer) external view returns (WithdrawalRequest memory) {
        return _withdrawals[customer];
    }

    function isBlocked(address account) external view returns (bool) {
        return _blocked[account];
    }

    function voucherDigest(Voucher calldata voucher) public view returns (bytes32) {
        return _hashTypedDataV4(voucher.structHash());
    }
}
