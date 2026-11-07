// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

abstract contract Constants {
    uint256 internal constant ONE_USDC = 1e6;
    uint256 internal constant INITIAL_FUNDS = 1_000_000 * ONE_USDC;
    uint256 internal constant DEPOSIT = 1000 * ONE_USDC;

    uint16 internal constant FEE_CAP_BPS = 3000;
    uint16 internal constant STANDARD_FEE_BPS = 2000;
    uint16 internal constant LOWER_FEE_CAP_BPS = 1500;
    uint64 internal constant DISPUTE_WINDOW = 24 hours;

    uint128 internal constant SESSION_SPEND_CAP = uint128(500 * ONE_USDC);
    uint128 internal constant SESSION_HOURLY_CAP = uint128(50 * ONE_USDC);
    uint64 internal constant SESSION_LIFETIME = 30 days;
    uint64 internal constant VOUCHER_LIFETIME = 7 days;

    uint256 internal constant HOST_AMOUNT = 10 * ONE_USDC;
    uint256 internal constant SERVICE_AMOUNT = ONE_USDC / 10;
    uint256 internal constant BPS = 10_000;

    bytes32 internal constant CHANNEL_ID = keccak256("channel-1");
    bytes32 internal constant OTHER_CHANNEL_ID = keccak256("channel-2");
    uint64 internal constant FIRST_SEQUENCE = 1;
    uint64 internal constant SECOND_SEQUENCE = 2;
}
