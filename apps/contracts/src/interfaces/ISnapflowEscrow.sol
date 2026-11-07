// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { Channel, FeeCapChange, SessionKey, SignedVoucher, Voucher, WithdrawalRequest } from "../types/EscrowTypes.sol";

/// @title ISnapflowEscrow
/// @notice Non-custodial USDC escrow for Snapflow sandboxes. Customers fund their own balance and sign cumulative
/// vouchers; a claim pays the host its full price and the platform its fee in one transaction.
interface ISnapflowEscrow {
    event Deposited(address indexed customer, address indexed payer, uint256 amount);
    event SessionKeySet(
        address indexed customer, address indexed key, uint128 spendCap, uint128 hourlyCap, uint64 expiry
    );
    event SessionKeyRevoked(address indexed customer, address indexed key);
    event Claimed(
        bytes32 indexed channelId,
        address indexed customer,
        address indexed host,
        uint256 hostPaid,
        uint256 feePaid,
        uint256 servicePaid,
        uint64 sequence
    );
    event WithdrawalRequested(address indexed customer, uint256 amount, uint64 readyAt);
    event WithdrawalCancelled(address indexed customer);
    event Withdrawn(address indexed customer, uint256 amount);
    event FeeCapScheduled(uint16 bps, uint64 effectiveAt);
    event FeeCapScheduleCancelled();
    event FeeCapUpdated(uint16 previousBps, uint16 bps);
    event FeeRecipientUpdated(address indexed previousRecipient, address indexed recipient);
    event AddressBlocked(address indexed account);
    event AddressUnblocked(address indexed account);

    error ZeroAddress();
    error ZeroAmount();
    error FeeCapTooHigh(uint16 bps, uint16 maxBps);
    error DisputeWindowOutOfRange(uint64 window);
    error AccountBlocked(address account);
    error VoucherExpired(uint64 expiry);
    error StaleVoucher(uint64 sequence, uint64 lastSequence);
    error ChannelMismatch(bytes32 channelId);
    error AmountDecreased(bytes32 channelId);
    error FeeAboveCap(uint256 feeDelta, uint256 allowed);
    error InvalidSignature(address signer);
    error SessionKeyInactive(address customer, address key);
    error SessionSpendCapExceeded(address key, uint256 requested, uint256 remaining);
    error SessionHourlyCapExceeded(address key, uint256 requested, uint256 remaining);
    error InvalidSessionKey();
    error InsufficientBalance(address customer, uint256 requested, uint256 available);
    error NoWithdrawalRequested(address customer);
    error WithdrawalNotReady(uint64 readyAt);
    error NoFeeCapScheduled();
    error FeeCapNotReady(uint64 effectiveAt);
    error EmptyBatch();

    function deposit(uint256 amount) external;
    function depositFor(address customer, uint256 amount) external;
    function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;

    function setSessionKey(address key, uint128 spendCap, uint128 hourlyCap, uint64 expiry) external;
    function revokeSessionKey(address key) external;

    function claim(SignedVoucher calldata signed) external;
    function claimBatch(SignedVoucher[] calldata signed) external;

    function requestWithdrawal(uint256 amount) external;
    function cancelWithdrawal() external;
    function withdraw() external;

    function scheduleFeeCap(uint16 bps) external;
    function cancelFeeCapSchedule() external;
    function applyFeeCap() external;
    function setFeeRecipient(address recipient) external;
    function blockAccount(address account) external;
    function unblockAccount(address account) external;
    function pause() external;
    function unpause() external;

    function balanceOf(address customer) external view returns (uint256);
    function channelOf(bytes32 channelId) external view returns (Channel memory);
    function sessionKeyOf(address customer, address key) external view returns (SessionKey memory);
    function withdrawalOf(address customer) external view returns (WithdrawalRequest memory);
    function pendingFeeCap() external view returns (FeeCapChange memory);
    function feeCapBps() external view returns (uint16);
    function feeRecipient() external view returns (address);
    function disputeWindow() external view returns (uint64);
    function isBlocked(address account) external view returns (bool);
    function voucherDigest(Voucher calldata voucher) external view returns (bytes32);
}
