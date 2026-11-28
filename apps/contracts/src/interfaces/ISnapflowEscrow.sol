// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import {
    Account,
    AccountBlock,
    AutoTopUp,
    BlockReason,
    ClaimItem,
    ClaimsFreeze,
    DepositCaps,
    SignerGrant,
    SignerScope,
    Voucher
} from "../types/EscrowTypes.sol";
import { ISnapflowEscrowErrors } from "./ISnapflowEscrowErrors.sol";
import { ISnapflowEscrowEvents } from "./ISnapflowEscrowEvents.sol";

interface ISnapflowEscrow is ISnapflowEscrowEvents, ISnapflowEscrowErrors {
    function deposit(uint256 amount) external;
    function depositFor(address customer, uint256 amount) external;
    function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    function depositWithAuthorization(
        address payer,
        address customer,
        uint256 amount,
        uint256 relayFee,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 salt,
        bytes calldata signature
    )
        external;
    function requestWithdrawal(uint256 amount) external;
    function cancelWithdrawal() external;
    function completeWithdrawal() external;

    function setAutoTopUp(
        address relayer,
        uint128 amount,
        uint128 threshold,
        uint128 maxRelayFee,
        uint32 minInterval
    )
        external;
    function disableAutoTopUp() external;
    function autoTopUp(address customer, uint256 relayFee) external;

    function authorizeSigner(
        address signer,
        SignerScope calldata scope,
        uint256 proofDeadline,
        bytes calldata proof
    )
        external;
    function raiseSignerLimit(address signer, uint96 hourlyCap, uint64 expiry) external;
    function lowerSignerLimit(address signer, uint96 hourlyCap) external;
    function thawSigner(address signer) external;
    function revokeSigner(address signer) external;

    function claim(
        Voucher calldata voucher,
        bytes calldata signature,
        address signer,
        uint128 maxAmount
    )
        external
        returns (uint128 paid);
    function claimBatch(ClaimItem[] calldata items) external returns (uint256 totalPaid);
    function claimBatchAndWithdraw(
        ClaimItem[] calldata items,
        address host,
        address payout,
        uint256 relayFee,
        uint256 deadline,
        bytes calldata hostSignature
    )
        external
        returns (uint256 totalPaid);

    function setPayoutAddress(address payout) external;
    function setPayoutAddressWithSig(address host, address payout, uint256 deadline, bytes calldata signature) external;
    function withdrawHost(address host) external;
    function withdrawHostWithSig(
        address host,
        address payout,
        uint256 relayFee,
        uint256 deadline,
        bytes calldata signature
    )
        external;
    function sweepFees(address feeReceiver) external;

    function pause() external;
    function unpause() external;
    function freezeClaims(uint64 duration) external;
    function rearmClaimsFreeze() external;
    function blockAccount(address account, BlockReason reason, uint64 duration) external;
    function unblockAccount(address account) external;
    function releaseFrozen(address account) external;
    function recoverSurplus(address to) external;
    function setDepositCaps(DepositCaps calldata caps) external;

    function token() external view returns (IERC20);
    function withdrawalDelay() external view returns (uint64);
    function claimWindow() external view returns (uint64);
    function signerThawPeriod() external view returns (uint64);
    function totalHeld() external view returns (uint256);
    function depositCaps() external view returns (DepositCaps memory);
    function maxDepositOf(address customer) external view returns (uint256);
    function accountOf(address account) external view returns (Account memory);
    function availableOf(address customer) external view returns (uint256);
    function autoTopUpOf(address customer) external view returns (AutoTopUp memory);
    function claimedOf(bytes32 channelId) external view returns (uint128);
    function channelIdOf(Voucher calldata voucher) external view returns (bytes32);
    function signerOf(address signer) external view returns (SignerGrant memory);
    function hostBalanceOf(address host) external view returns (uint256);
    function payoutAddressOf(address host) external view returns (address);
    function payoutNonceOf(address host) external view returns (uint256);
    function hostWithdrawalNonceOf(address host) external view returns (uint256);
    function feesAccruedOf(address feeReceiver) external view returns (uint256);
    function frozenBalanceOf(address account) external view returns (uint256);
    function blockedAt(address account) external view returns (uint64);
    function blockOf(address account) external view returns (AccountBlock memory);
    function claimsFreeze() external view returns (ClaimsFreeze memory);
    function unfrozenTime() external view returns (uint64);
    function voucherDigest(Voucher calldata voucher) external view returns (bytes32);
    function payoutAddressDigest(
        address host,
        address payout,
        uint256 nonce,
        uint256 deadline
    )
        external
        view
        returns (bytes32);
    function hostWithdrawalDigest(
        address host,
        address payout,
        address relayer,
        uint256 relayFee,
        uint256 nonce,
        uint256 deadline
    )
        external
        view
        returns (bytes32);
}
