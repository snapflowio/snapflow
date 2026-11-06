// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

/// @notice Fixed limits of the escrow. None of these can be changed after deployment.
library EscrowLimits {
    uint16 internal constant BPS_DENOMINATOR = 10_000;

    /// @notice Highest platform fee a voucher may ever carry: a 30% markup on the host's price.
    uint16 internal constant MAX_FEE_BPS = 3000;

    /// @notice Delay before a fee cap increase takes effect.
    uint64 internal constant FEE_CAP_TIMELOCK = 7 days;

    /// @notice Bounds for the withdrawal dispute window chosen at deployment.
    uint64 internal constant MIN_DISPUTE_WINDOW = 1 hours;
    uint64 internal constant MAX_DISPUTE_WINDOW = 7 days;

    /// @notice Length of the window a session key's hourly cap applies to.
    uint64 internal constant SESSION_RATE_WINDOW = 1 hours;

    /// @notice Delay before a new default admin can accept the role.
    uint48 internal constant ADMIN_TRANSFER_DELAY = 3 days;
}
