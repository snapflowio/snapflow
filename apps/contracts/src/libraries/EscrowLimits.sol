// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

library EscrowLimits {
    uint16 internal constant BPS_DENOMINATOR = 10_000;

    uint16 internal constant MAX_FEE_BPS = 3000;

    uint64 internal constant MIN_WITHDRAWAL_DELAY = 1 hours;
    uint64 internal constant MAX_WITHDRAWAL_DELAY = 7 days;

    uint64 internal constant MIN_CLAIM_WINDOW = 1 hours;
    uint64 internal constant MAX_CLAIM_WINDOW = 7 days;

    uint64 internal constant MAX_SIGNER_THAW_PERIOD = 30 days;

    uint64 internal constant SIGNER_BURST_HOURS = 24;

    uint64 internal constant SECONDS_PER_HOUR = 1 hours;

    uint256 internal constant MAX_RELAY_FEE = 1_000_000;

    uint32 internal constant MIN_AUTO_TOP_UP_INTERVAL = 1 hours;

    uint64 internal constant MAX_BLOCK_DURATION = 90 days;

    uint64 internal constant MAX_CLAIMS_FREEZE = 72 hours;

    uint64 internal constant CLAIMS_FREEZE_COOLDOWN = 30 days;

    uint256 internal constant MAX_BATCH_SIZE = 20;

    uint256 internal constant BATCH_ITEM_GAS = 500_000;

    uint48 internal constant ADMIN_TRANSFER_DELAY = 5 days;
}
