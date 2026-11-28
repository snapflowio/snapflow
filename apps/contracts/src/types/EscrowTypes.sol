// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

struct Voucher {
    address customer;
    address host;
    address feeReceiver;
    uint16 feeBps;
    bytes32 salt;
    uint128 cumulativeAmount;
    uint64 timestamp;
    bytes32 metadata;
}

struct ClaimItem {
    Voucher voucher;
    bytes signature;
    address signer;
    uint128 maxAmount;
}

struct Account {
    uint128 free;
    uint128 pending;
    uint64 unlockAt;
}

struct AutoTopUp {
    address relayer;
    uint32 minInterval;
    uint64 lastTopUpAt;
    uint128 amount;
    uint128 threshold;
    uint128 maxRelayFee;
}

struct SignerScope {
    uint96 hourlyCap;
    uint64 expiry;
    uint16 maxFeeBps;
    address host;
}

struct SignerGrant {
    address customer;
    uint64 expiry;
    bool revoked;
    uint16 maxFeeBps;
    uint96 hourlyCap;
    uint96 pendingHourlyCap;
    uint64 updatedAt;
    uint128 available;
    uint64 pendingEffectiveAt;
    uint64 thawEnd;
    uint64 freezeOffset;
    uint16 remainder;
    address host;
}

enum BlockReason {
    Sanctions,
    Fraud
}

struct AccountBlock {
    uint64 blockedAt;
    uint64 until;
    BlockReason reason;
}

struct ClaimsFreeze {
    uint64 since;
    uint64 until;
    uint64 accumulated;
    bool armed;
}

struct EscrowRoles {
    address admin;
    address pauser;
    address guardian;
    address claimsFreezer;
    address compliance;
}

struct EscrowWindows {
    uint64 withdrawalDelay;
    uint64 claimWindow;
    uint64 signerThawPeriod;
}

struct DepositCaps {
    uint128 total;
    uint128 perAccount;
}

enum ClaimFailure {
    None,
    ClaimsFrozen,
    InvalidVoucherTerms,
    VoucherFromFuture,
    InvalidSignature,
    SignerNotAuthorized,
    SignerExpired,
    SignerHostMismatch,
    FeeAboveSignerLimit,
    CustomerBlockedForVoucher,
    ZeroAmount,
    NothingToClaim,
    InsufficientBalance,
    SignerCapReached,
    Other
}
