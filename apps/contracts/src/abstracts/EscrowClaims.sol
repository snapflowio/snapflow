// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { Math } from "@openzeppelin-contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin-contracts/utils/math/SafeCast.sol";
import { ClaimFailures } from "../libraries/ClaimFailures.sol";
import { EscrowHashing } from "../libraries/EscrowHashing.sol";
import { EscrowLimits } from "../libraries/EscrowLimits.sol";
import { PaymentMath } from "../libraries/PaymentMath.sol";
import { ClaimFailure, ClaimItem, Voucher } from "../types/EscrowTypes.sol";
import { EscrowAccounts } from "./EscrowAccounts.sol";
import { EscrowFees } from "./EscrowFees.sol";
import { EscrowPayouts } from "./EscrowPayouts.sol";
import { EscrowSigners } from "./EscrowSigners.sol";

abstract contract EscrowClaims is EscrowAccounts, EscrowSigners, EscrowPayouts, EscrowFees {
    mapping(bytes32 channelId => uint128) private _claimed;

    function claim(
        Voucher calldata voucher,
        bytes calldata signature,
        address signer,
        uint128 maxAmount
    )
        external
        returns (uint128 paid)
    {
        _requireClaimsNotFrozen();
        bytes32 channelId = EscrowHashing.channelIdOf(voucher, address(this));
        _requireValidVoucher(voucher, channelId);
        uint256 signerRemaining = _authorizeVoucherSigner(signer, voucher, voucherDigest(voucher), signature);
        address customer = voucher.customer;
        paid = _payable(channelId, voucher, maxAmount, signerRemaining, signer);

        uint128 claimed = _claimed[channelId] + paid;
        _claimed[channelId] = claimed;
        _debitForClaim(customer, paid);
        if (signer != customer) _chargeSigner(signer, paid);

        uint256 fee = PaymentMath.fee(paid, voucher.feeBps);
        address host = voucher.host;
        // forge-lint: disable-next-line(unsafe-typecast)
        emit Claimed(channelId, customer, host, signer, voucher.feeReceiver, paid, uint128(fee), claimed);
        _creditHost(host, paid - fee);
        _creditFee(voucher.feeReceiver, fee);
    }

    function claimBatch(ClaimItem[] calldata items) external returns (uint256 totalPaid) {
        return _claimBatch(items);
    }

    function claimBatchAndWithdraw(
        ClaimItem[] calldata items,
        address host,
        address payout,
        uint256 relayFee,
        uint256 deadline,
        bytes calldata hostSignature
    )
        external
        nonReentrant
        returns (uint256 totalPaid)
    {
        _verifyHostWithdrawal(host, payout, relayFee, deadline, hostSignature);
        totalPaid = _claimBatch(items);
        // slither-disable-next-line reentrancy-benign
        _withdrawHost(host, payout, relayFee);
    }

    function claimedOf(bytes32 channelId) external view returns (uint128) {
        return _claimed[channelId];
    }

    function channelIdOf(Voucher calldata voucher) external view returns (bytes32) {
        return EscrowHashing.channelIdOf(voucher, address(this));
    }

    function voucherDigest(Voucher calldata voucher) public view returns (bytes32) {
        return _hashTypedDataV4(EscrowHashing.voucherStructHash(voucher));
    }

    // forge-lint: disable-next-item(calls-loop) the loop's only external call is the bounded self-call per item
    function _claimBatch(ClaimItem[] calldata items) private returns (uint256 totalPaid) {
        uint256 count = items.length;
        if (count == 0) revert EmptyBatch();
        if (count > EscrowLimits.MAX_BATCH_SIZE) revert BatchTooLarge(count, EscrowLimits.MAX_BATCH_SIZE);
        for (uint256 i; i < count; ++i) {
            ClaimItem calldata item = items[i];
            bytes32 channelId = EscrowHashing.channelIdOf(item.voucher, address(this));
            // slither-disable-start calls-loop,reentrancy-events
            try this.claim{ gas: EscrowLimits.BATCH_ITEM_GAS }(
                item.voucher, item.signature, item.signer, item.maxAmount
            ) returns (
                uint128 paid
            ) {
                totalPaid += paid;
                emit ClaimResult(channelId, paid, ClaimFailure.None);
            } catch (bytes memory revertData) {
                emit ClaimResult(channelId, 0, ClaimFailures.fromRevert(revertData));
            }
            // slither-disable-end calls-loop,reentrancy-events
        }
    }

    function _requireValidVoucher(Voucher calldata voucher, bytes32 channelId) private view {
        if (
            voucher.customer == address(0) || voucher.host == address(0) || voucher.feeBps > EscrowLimits.MAX_FEE_BPS
                || (voucher.feeBps != 0 && voucher.feeReceiver == address(0))
        ) revert InvalidVoucherTerms(channelId);
        uint64 timestamp = voucher.timestamp;
        if (timestamp > block.timestamp) revert VoucherFromFuture(timestamp);
        uint64 customerBlockedAt = blockedAt(voucher.customer);
        if (customerBlockedAt != 0) revert CustomerBlockedForVoucher(voucher.customer, customerBlockedAt);
    }

    function _payable(
        bytes32 channelId,
        Voucher calldata voucher,
        uint128 maxAmount,
        uint256 signerRemaining,
        address signer
    )
        private
        view
        returns (uint128)
    {
        if (maxAmount == 0) revert ZeroAmount();
        uint128 claimed = _claimed[channelId];
        if (voucher.cumulativeAmount <= claimed) revert NothingToClaim(channelId);
        if (signerRemaining == 0) revert SignerCapReached(signer);
        uint256 available = availableOf(voucher.customer);
        if (available == 0) revert InsufficientBalance(voucher.customer);

        uint256 amount = Math.min(maxAmount, voucher.cumulativeAmount - claimed);
        amount = Math.min(Math.min(amount, signerRemaining), available);
        return SafeCast.toUint128(amount);
    }
}
