// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { BlockReason, ClaimFailure } from "../types/EscrowTypes.sol";

interface ISnapflowEscrowEvents {
    event Deposited(address indexed customer, address indexed payer, uint256 amount);
    event DepositCapsSet(uint128 total, uint128 perAccount);
    event RelayFeePaid(address indexed relayer, address indexed payer, uint256 amount);
    event WithdrawalRequested(address indexed account, uint256 amount, uint128 pending, uint64 unlockAt);
    event WithdrawalCancelled(address indexed account, uint128 amount);
    event Withdrawn(address indexed account, uint256 amount);

    event AutoTopUpSet(
        address indexed customer,
        address indexed relayer,
        uint128 amount,
        uint128 threshold,
        uint128 maxRelayFee,
        uint32 minInterval
    );
    event AutoTopUpDisabled(address indexed customer);
    event AutoTopUpExecuted(address indexed customer, address indexed relayer, uint256 amount, uint256 relayFee);

    event SignerAuthorized(
        address indexed customer,
        address indexed signer,
        uint96 hourlyCap,
        uint64 expiry,
        uint16 maxFeeBps,
        address host
    );
    event SignerLimitRaised(address indexed customer, address indexed signer, uint96 hourlyCap, uint64 expiry);
    event SignerLimitLowerScheduled(
        address indexed customer, address indexed signer, uint96 hourlyCap, uint64 effectiveAt
    );
    event SignerThawed(address indexed customer, address indexed signer, uint64 thawEnd);
    event SignerRevoked(address indexed customer, address indexed signer);

    event Claimed(
        bytes32 indexed channelId,
        address indexed customer,
        address indexed host,
        address signer,
        address feeReceiver,
        uint128 paid,
        uint128 fee,
        uint128 claimed
    );
    event ClaimResult(bytes32 indexed channelId, uint128 paid, ClaimFailure reason);

    event PayoutAddressSet(address indexed host, address indexed payout);
    event HostWithdrawn(address indexed host, address indexed payout, uint256 amount);
    event FeesSwept(address indexed feeReceiver, uint256 amount);

    event AccountBlocked(address indexed account, BlockReason reason, uint64 blockedAt, uint64 until);
    event AccountUnblocked(address indexed account);
    event Frozen(address indexed account, uint256 amount);
    event FrozenReleased(address indexed account, uint256 amount);

    event ClaimsFrozen(address indexed by, uint64 until);
    event ClaimsFreezeRearmed();

    event SurplusRecovered(address indexed to, uint256 amount);
}
