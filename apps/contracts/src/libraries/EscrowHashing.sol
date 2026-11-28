// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { MessageHashUtils } from "@openzeppelin-contracts/utils/cryptography/MessageHashUtils.sol";
import { Voucher } from "../types/EscrowTypes.sol";

library EscrowHashing {
    bytes32 internal constant VOUCHER_TYPEHASH = keccak256(
        "Voucher(address customer,address host,address feeReceiver,uint16 feeBps,bytes32 salt,uint128 cumulativeAmount,uint64 timestamp,bytes32 metadata)"
    );

    bytes32 internal constant PAYOUT_ADDRESS_TYPEHASH =
        keccak256("PayoutAddress(address host,address payout,uint256 nonce,uint256 deadline)");

    bytes32 internal constant HOST_WITHDRAWAL_TYPEHASH = keccak256(
        "HostWithdrawal(address host,address payout,address relayer,uint256 relayFee,uint256 nonce,uint256 deadline)"
    );

    string internal constant SIGNER_PROOF_TAG = "authorizeSignerProof";

    bytes32 internal constant DEPOSIT_AUTHORIZATION_TAG = keccak256("SnapflowEscrow.depositWithAuthorization");

    function voucherStructHash(Voucher calldata voucher) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                VOUCHER_TYPEHASH,
                voucher.customer,
                voucher.host,
                voucher.feeReceiver,
                voucher.feeBps,
                voucher.salt,
                voucher.cumulativeAmount,
                voucher.timestamp,
                voucher.metadata
            )
        );
    }

    function channelIdOf(Voucher calldata voucher, address escrow) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid, escrow, voucher.customer, voucher.host, voucher.feeReceiver, voucher.feeBps, voucher.salt
            )
        );
    }

    function payoutAddressStructHash(
        address host,
        address payout,
        uint256 nonce,
        uint256 deadline
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(PAYOUT_ADDRESS_TYPEHASH, host, payout, nonce, deadline));
    }

    function hostWithdrawalStructHash(
        address host,
        address payout,
        address relayer,
        uint256 relayFee,
        uint256 nonce,
        uint256 deadline
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(HOST_WITHDRAWAL_TYPEHASH, host, payout, relayer, relayFee, nonce, deadline));
    }

    function signerProofDigest(address escrow, uint256 deadline, address customer) internal view returns (bytes32) {
        return MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked(block.chainid, escrow, SIGNER_PROOF_TAG, deadline, customer))
        );
    }

    function depositNonce(
        address escrow,
        address payer,
        address customer,
        address relayer,
        uint256 amount,
        uint256 relayFee,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 salt
    )
        internal
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                DEPOSIT_AUTHORIZATION_TAG,
                block.chainid,
                escrow,
                payer,
                customer,
                relayer,
                amount,
                relayFee,
                validAfter,
                validBefore,
                salt
            )
        );
    }
}
