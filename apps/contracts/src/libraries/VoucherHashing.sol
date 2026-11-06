// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { Voucher } from "../types/EscrowTypes.sol";

/// @notice EIP-712 struct hashing for vouchers. The SDK, API and host daemon reproduce this byte for byte.
library VoucherHashing {
    bytes32 internal constant VOUCHER_TYPEHASH = keccak256(
        "Voucher(bytes32 channelId,address customer,address host,uint256 hostAmount,uint256 feeAmount,uint256 serviceAmount,uint64 sequence,uint64 expiry)"
    );

    function structHash(Voucher calldata voucher) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                VOUCHER_TYPEHASH,
                voucher.channelId,
                voucher.customer,
                voucher.host,
                voucher.hostAmount,
                voucher.feeAmount,
                voucher.serviceAmount,
                voucher.sequence,
                voucher.expiry
            )
        );
    }
}
