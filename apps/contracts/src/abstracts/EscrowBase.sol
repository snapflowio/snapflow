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
import { SafeERC20 } from "@openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import { EIP712 } from "@openzeppelin-contracts/utils/cryptography/EIP712.sol";
import { Pausable } from "@openzeppelin-contracts/utils/Pausable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin-contracts/utils/ReentrancyGuardTransient.sol";
import { ISnapflowEscrow } from "../interfaces/ISnapflowEscrow.sol";
import { EscrowLimits } from "../libraries/EscrowLimits.sol";
import { EscrowRoles, EscrowWindows } from "../types/EscrowTypes.sol";

abstract contract EscrowBase is
    ISnapflowEscrow,
    AccessControlDefaultAdminRules,
    EIP712,
    Pausable,
    ReentrancyGuardTransient
{
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant CLAIMS_FREEZE_ROLE = keccak256("CLAIMS_FREEZE_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    string private constant DOMAIN_NAME = "SnapflowEscrow";
    string private constant DOMAIN_VERSION = "3";

    IERC20 public immutable token;

    uint64 public immutable withdrawalDelay;

    uint64 public immutable claimWindow;

    uint64 public immutable signerThawPeriod;

    uint256 private _totalHeld;

    constructor(
        IERC20 token_,
        EscrowRoles memory roles,
        EscrowWindows memory windows
    )
        AccessControlDefaultAdminRules(EscrowLimits.ADMIN_TRANSFER_DELAY, roles.admin)
        EIP712(DOMAIN_NAME, DOMAIN_VERSION)
    {
        if (address(token_) == address(0)) revert ZeroAddress();
        if (
            windows.withdrawalDelay < EscrowLimits.MIN_WITHDRAWAL_DELAY
                || windows.withdrawalDelay > EscrowLimits.MAX_WITHDRAWAL_DELAY
        ) revert WithdrawalDelayOutOfRange(windows.withdrawalDelay);
        if (windows.claimWindow < EscrowLimits.MIN_CLAIM_WINDOW || windows.claimWindow > EscrowLimits.MAX_CLAIM_WINDOW)
        {
            revert ClaimWindowOutOfRange(windows.claimWindow);
        }
        if (
            windows.signerThawPeriod < windows.withdrawalDelay
                || windows.signerThawPeriod > EscrowLimits.MAX_SIGNER_THAW_PERIOD
        ) revert SignerThawPeriodOutOfRange(windows.signerThawPeriod);
        token = token_;
        withdrawalDelay = windows.withdrawalDelay;
        claimWindow = windows.claimWindow;
        signerThawPeriod = windows.signerThawPeriod;
        _grantOperatingRole(PAUSER_ROLE, roles.pauser);
        _grantOperatingRole(PAUSER_ROLE, roles.guardian);
        _grantOperatingRole(CLAIMS_FREEZE_ROLE, roles.claimsFreezer);
        _grantOperatingRole(COMPLIANCE_ROLE, roles.compliance);
    }

    function totalHeld() public view returns (uint256) {
        return _totalHeld;
    }

    function _pullTokens(uint256 amount) internal {
        _totalHeld += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function _recordTokensIn(uint256 amount) internal {
        _totalHeld += amount;
    }

    function _pushTokens(address to, uint256 amount) internal {
        _totalHeld -= amount;
        token.safeTransfer(to, amount);
    }

    function _forwardTokens(address to, uint256 amount) internal {
        token.safeTransfer(to, amount);
    }

    function _changeDefaultAdminDelay(uint48 newDelay) internal override {
        if (newDelay < EscrowLimits.ADMIN_TRANSFER_DELAY) {
            revert AdminDelayTooShort(newDelay, EscrowLimits.ADMIN_TRANSFER_DELAY);
        }
        super._changeDefaultAdminDelay(newDelay);
    }

    function _now64() internal view returns (uint64) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(block.timestamp);
    }

    function _grantOperatingRole(bytes32 role, address account) private {
        if (account == address(0)) revert ZeroAddress();
        _grantRole(role, account);
    }
}
