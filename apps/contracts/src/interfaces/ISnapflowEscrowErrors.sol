// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

interface ISnapflowEscrowErrors {
    error WithdrawalDelayOutOfRange(uint64 delay);
    error ClaimWindowOutOfRange(uint64 window);
    error SignerThawPeriodOutOfRange(uint64 period);
    error AdminDelayTooShort(uint48 delay, uint48 minDelay);

    error ZeroAddress();
    error ZeroAmount();
    error NotAuthorized(address caller);
    error NothingToWithdraw(address account);
    error RelayFeeTooHigh(uint256 relayFee, uint256 maxRelayFee);
    error TotalDepositCapExceeded(uint256 amount, uint256 room);
    error AccountDepositCapExceeded(address account, uint256 amount, uint256 room);

    error InsufficientFreeBalance(address account, uint256 requested, uint256 available);
    error NoWithdrawalPending(address account);
    error WithdrawalLocked(address account, uint64 unlockAt);

    error InvalidAutoTopUpRelayer(address relayer);
    error AutoTopUpIntervalTooShort(uint32 interval, uint32 minInterval);
    error AutoTopUpNotEnabled(address customer);
    error AutoTopUpTooSoon(address customer, uint64 nextAt);
    error AutoTopUpNotNeeded(address customer, uint256 available);

    error InvalidSigner(address signer);
    error SignerAlreadyBound(address signer, address customer);
    error SignerProofExpired(uint256 deadline);
    error InvalidSignerProof(address signer);
    error InvalidSignerScope();
    error SignerAlreadyThawing(address signer, uint64 thawEnd);
    error SignerNotThawing(address signer);
    error SignerStillThawing(address signer, uint64 thawEnd);

    error ClaimsAreFrozen(uint64 until);
    error InvalidVoucherTerms(bytes32 channelId);
    error VoucherFromFuture(uint64 timestamp);
    error InvalidSignature(address signer);
    error SignerNotAuthorized(address signer);
    error SignerExpired(address signer);
    error SignerHostMismatch(address signer, address host);
    error FeeAboveSignerLimit(uint16 feeBps, uint16 maxFeeBps);
    error CustomerBlockedForVoucher(address customer, uint64 blockedAt);
    error NothingToClaim(bytes32 channelId);
    error InsufficientBalance(address customer);
    error SignerCapReached(address signer);
    error EmptyBatch();
    error BatchTooLarge(uint256 size, uint256 maxSize);

    error PayoutSignatureExpired(uint256 deadline);
    error InvalidPayoutSignature(address host);
    error HostWithdrawalSignatureExpired(uint256 deadline);
    error InvalidHostWithdrawalSignature(address host);

    error Blocked(address account);
    error BlockDurationOutOfRange(uint64 duration, uint64 maxDuration);
    error AccountNotBlocked(address account);

    error ClaimsFreezeUnavailable();
    error ClaimsFreezeTooLong(uint64 duration, uint64 maxDuration);
    error ClaimsFreezeArmed();
    error ClaimsFreezeCoolingDown(uint64 rearmAt);

    error NoSurplus();
}
