// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import { EscrowBase } from "./abstracts/EscrowBase.sol";
import { EscrowAutoTopUp } from "./abstracts/EscrowAutoTopUp.sol";
import { EscrowClaims } from "./abstracts/EscrowClaims.sol";
import { DepositCaps, EscrowRoles, EscrowWindows } from "./types/EscrowTypes.sol";

contract SnapflowEscrow is EscrowClaims, EscrowAutoTopUp {
    using SafeERC20 for IERC20;

    constructor(
        IERC20 token_,
        EscrowRoles memory roles,
        EscrowWindows memory windows,
        DepositCaps memory caps
    )
        EscrowBase(token_, roles, windows)
    {
        _setDepositCaps(caps);
    }

    // recover
    function recoverSurplus(address to) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = token.balanceOf(address(this));
        uint256 held = totalHeld();
        if (balance <= held) revert NoSurplus();
        uint256 surplus = balance - held;
        emit SurplusRecovered(to, surplus);
        token.safeTransfer(to, surplus);
    }

    function _takeBalancesOf(address account) internal override returns (uint256) {
        return _takeAccount(account) + _takeHostBalance(account) + _takeFees(account);
    }
}
