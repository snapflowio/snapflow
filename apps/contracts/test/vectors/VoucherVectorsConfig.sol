// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { Voucher } from "../../src/types/EscrowTypes.sol";

/// @notice Fixed inputs for the cross-language voucher vectors. The signer key is a public test key with no value.
abstract contract VoucherVectorsConfig {
    string internal constant VECTORS_PATH = "test/vectors/vouchers.json";
    uint256 internal constant VECTOR_CHAIN_ID = 84_532;
    address internal constant VECTOR_TOKEN = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address internal constant VECTOR_ADMIN = 0x00000000000000000000000000000000000Ad1a1;
    address internal constant VECTOR_FEE_RECIPIENT = 0x000000000000000000000000000000000000Fee5;
    uint16 internal constant VECTOR_FEE_CAP_BPS = 3000;
    uint64 internal constant VECTOR_WINDOW = 24 hours;
    uint256 internal constant VECTOR_SIGNER_KEY = 0xA11CE;

    address private constant VECTOR_CUSTOMER = 0x000000000000000000000000000000000000c057;
    address private constant VECTOR_HOST = 0x0000000000000000000000000000000000000057;
    uint64 private constant VECTOR_EXPIRY = 1_900_000_000;
    uint256 private constant MICRO_USDC = 1;
    uint256 private constant ONE_USDC = 1e6;

    /// @notice Lease ids paired with the channel id `keccak256(abi.encode(customer, host, leaseId))` derived from them.
    function vectorLeaseIds() internal pure returns (string[] memory leaseIds) {
        leaseIds = new string[](2);
        leaseIds[0] = "0b5f3c2e-9d4a-4e1b-8c7f-2a6d9e0f1b3c";
        leaseIds[1] = "";
    }

    function vectorChannelId(string memory leaseId) internal pure returns (bytes32) {
        return keccak256(abi.encode(VECTOR_CUSTOMER, VECTOR_HOST, leaseId));
    }

    function vectorVouchers() internal pure returns (Voucher[] memory vouchers) {
        vouchers = new Voucher[](3);
        vouchers[0] = Voucher({
            channelId: keccak256("vector-channel"),
            customer: VECTOR_CUSTOMER,
            host: VECTOR_HOST,
            hostAmount: ONE_USDC,
            feeAmount: ONE_USDC / 5,
            serviceAmount: 0,
            sequence: 1,
            expiry: VECTOR_EXPIRY
        });
        vouchers[1] = Voucher({
            channelId: keccak256("vector-channel"),
            customer: VECTOR_CUSTOMER,
            host: VECTOR_HOST,
            hostAmount: 123_456_789,
            feeAmount: 24_691_357,
            serviceAmount: 4321,
            sequence: 2,
            expiry: VECTOR_EXPIRY
        });
        vouchers[2] = Voucher({
            channelId: bytes32(type(uint256).max),
            customer: VECTOR_CUSTOMER,
            host: VECTOR_HOST,
            hostAmount: type(uint256).max / 2,
            feeAmount: MICRO_USDC,
            serviceAmount: MICRO_USDC,
            sequence: type(uint64).max,
            expiry: type(uint64).max
        });
    }
}
