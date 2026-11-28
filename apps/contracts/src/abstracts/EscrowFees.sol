// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { EscrowCompliance } from "./EscrowCompliance.sol";

abstract contract EscrowFees is EscrowCompliance {
    mapping(address feeReceiver => uint256) private _feesAccrued;

    function sweepFees(address feeReceiver) external nonReentrant {
        uint256 amount = _takeFees(feeReceiver);
        if (amount == 0) revert NothingToWithdraw(feeReceiver);
        emit FeesSwept(feeReceiver, amount);
        _pushTokens(feeReceiver, amount);
    }

    function feesAccruedOf(address feeReceiver) external view returns (uint256) {
        return _feesAccrued[feeReceiver];
    }

    function _creditFee(address feeReceiver, uint256 amount) internal {
        if (amount == 0 || _divertIfBlocked(feeReceiver, amount)) return;
        _feesAccrued[feeReceiver] += amount;
    }

    function _takeFees(address feeReceiver) internal returns (uint256 amount) {
        amount = _feesAccrued[feeReceiver];
        _feesAccrued[feeReceiver] = 0;
    }
}
