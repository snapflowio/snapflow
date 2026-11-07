// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

/// @notice Cumulative payment promise for one sandbox lease. Every field except `sequence` and `expiry` only
/// grows, so the host submits only the latest voucher and a lost voucher costs nothing.
struct Voucher {
    bytes32 channelId;
    address customer;
    address host;
    uint256 hostAmount;
    uint256 feeAmount;
    uint256 serviceAmount;
    uint64 sequence;
    uint64 expiry;
}

/// @notice A voucher with the key that signed it. `signer` is the customer itself or one of its session keys.
struct SignedVoucher {
    Voucher voucher;
    address signer;
    bytes signature;
}

/// @notice Limits on a key the customer allows to sign vouchers for it. The hourly cap accrues from activation, so
/// claims batched over several hours still fit while a key can never spend faster than the customer allowed.
struct SessionKey {
    uint128 spendCap;
    uint128 spent;
    uint128 hourlyCap;
    uint64 activatedAt;
    uint64 expiry;
}

/// @notice Amounts already paid out for a channel, and the parties it is bound to on first claim.
struct Channel {
    address customer;
    address host;
    uint64 sequence;
    uint256 hostClaimed;
    uint256 feeClaimed;
    uint256 serviceClaimed;
}

struct WithdrawalRequest {
    uint256 amount;
    uint64 readyAt;
}

struct FeeCapChange {
    uint16 bps;
    uint64 effectiveAt;
}
