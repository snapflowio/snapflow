// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { Math } from "@openzeppelin-contracts/utils/math/Math.sol";
import { ISnapflowEscrow } from "../interfaces/ISnapflowEscrow.sol";
import { EscrowLimits } from "../libraries/EscrowLimits.sol";
import { SessionKey } from "../types/EscrowTypes.sol";

/// @notice Keys a customer allows to sign vouchers on its behalf, each bounded by a total cap, an hourly rate and an
/// expiry. The SDK's local key and Snapflow's delegated signer are both session keys.
abstract contract EscrowSessionKeys is ISnapflowEscrow {
    mapping(address customer => mapping(address key => SessionKey)) private _sessionKeys;

    function _setSessionKey(
        address customer,
        address key,
        uint128 spendCap,
        uint128 hourlyCap,
        uint64 expiry
    )
        internal
    {
        if (key == address(0) || key == customer) revert InvalidSessionKey();
        if (spendCap == 0 || hourlyCap == 0) revert ZeroAmount();
        if (expiry <= block.timestamp) revert InvalidSessionKey();
        // block.timestamp fits uint64 for billions of years.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 activatedAt = uint64(block.timestamp);
        _sessionKeys[customer][key] = SessionKey({
            spendCap: spendCap, spent: 0, hourlyCap: hourlyCap, activatedAt: activatedAt, expiry: expiry
        });
        emit SessionKeySet(customer, key, spendCap, hourlyCap, expiry);
    }

    function _revokeSessionKey(address customer, address key) internal {
        delete _sessionKeys[customer][key];
        emit SessionKeyRevoked(customer, key);
    }

    /// @dev Records `amount` against the key's limits or reverts when it would exceed one of them.
    function _consumeSessionAllowance(address customer, address key, uint256 amount) internal {
        SessionKey storage session = _sessionKeys[customer][key];
        if (session.expiry < block.timestamp) revert SessionKeyInactive(customer, key);

        uint256 remaining = session.spendCap - session.spent;
        if (amount > remaining) revert SessionSpendCapExceeded(key, amount, remaining);

        uint256 elapsedWindows = (block.timestamp - session.activatedAt) / EscrowLimits.SESSION_RATE_WINDOW + 1;
        uint256 rateAllowance = Math.saturatingMul(session.hourlyCap, elapsedWindows);
        uint256 rateRemaining = rateAllowance > session.spent ? rateAllowance - session.spent : 0;
        if (amount > rateRemaining) revert SessionHourlyCapExceeded(key, amount, rateRemaining);

        // amount is at most spendCap - spent, both uint128, so the cast cannot truncate.
        // forge-lint: disable-next-line(unsafe-typecast)
        session.spent += uint128(amount);
    }

    function sessionKeyOf(address customer, address key) external view returns (SessionKey memory) {
        return _sessionKeys[customer][key];
    }
}
