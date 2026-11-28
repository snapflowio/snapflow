// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { EscrowLimits } from "../libraries/EscrowLimits.sol";
import { AccountBlock, BlockReason } from "../types/EscrowTypes.sol";
import { EscrowBase } from "./EscrowBase.sol";

abstract contract EscrowCompliance is EscrowBase {
    mapping(address account => AccountBlock) private _blocks;
    mapping(address account => uint256) private _frozen;

    function blockAccount(address account, BlockReason reason, uint64 duration) external onlyRole(COMPLIANCE_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        if (duration == 0 || duration > EscrowLimits.MAX_BLOCK_DURATION) {
            revert BlockDurationOutOfRange(duration, EscrowLimits.MAX_BLOCK_DURATION);
        }
        AccountBlock storage entry = _blocks[account];
        uint64 now64 = _now64();
        uint64 until = now64 + duration;
        bool isNew = !_isBlocked(entry);
        if (isNew) {
            entry.blockedAt = now64;
        } else if (entry.until > until) {
            until = entry.until;
        }
        entry.until = until;
        entry.reason = reason;
        emit AccountBlocked(account, reason, entry.blockedAt, until);
        if (!isNew) return;
        uint256 owed = _takeBalancesOf(account);
        if (owed > 0) _freezeFor(account, owed);
    }

    function unblockAccount(address account) external onlyRole(COMPLIANCE_ROLE) {
        if (!_isBlocked(_blocks[account])) revert AccountNotBlocked(account);
        delete _blocks[account];
        emit AccountUnblocked(account);
    }

    function releaseFrozen(address account) external {
        _requireNotBlocked(account);
        uint256 amount = _frozen[account];
        if (amount == 0) revert NothingToWithdraw(account);
        delete _frozen[account];
        emit FrozenReleased(account, amount);
        _creditReleased(account, amount);
    }

    function blockedAt(address account) public view returns (uint64) {
        AccountBlock storage entry = _blocks[account];
        return _isBlocked(entry) ? entry.blockedAt : 0;
    }

    function blockOf(address account) external view returns (AccountBlock memory) {
        return _blocks[account];
    }

    function frozenBalanceOf(address account) external view returns (uint256) {
        return _frozen[account];
    }

    function _requireNotBlocked(address account) internal view {
        if (_isBlocked(_blocks[account])) revert Blocked(account);
    }

    function _divertIfBlocked(address account, uint256 amount) internal returns (bool) {
        if (!_isBlocked(_blocks[account])) return false;
        _freezeFor(account, amount);
        return true;
    }

    function _takeBalancesOf(address account) internal virtual returns (uint256);

    function _creditReleased(address account, uint256 amount) internal virtual;

    function _isBlocked(AccountBlock storage entry) private view returns (bool) {
        return block.timestamp < entry.until;
    }

    function _freezeFor(address account, uint256 amount) private {
        _frozen[account] += amount;
        emit Frozen(account, amount);
    }
}
