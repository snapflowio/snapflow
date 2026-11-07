// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { ECDSA } from "@openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import { Test } from "forge-std/Test.sol";
import { SnapflowEscrow } from "../../src/SnapflowEscrow.sol";
import { Voucher } from "../../src/types/EscrowTypes.sol";
import { VoucherVectorsConfig } from "./VoucherVectorsConfig.sol";

/// @notice Fails when the committed vectors drift from the contract, so the TypeScript and Go checks stay meaningful.
contract VoucherVectors_Test is Test, VoucherVectorsConfig {
    function test_CommittedVectorsMatchContract() external {
        vm.chainId(VECTOR_CHAIN_ID);
        string memory json = vm.readFile(VECTORS_PATH);
        address verifyingContract = vm.parseJsonAddress(json, ".verifyingContract");
        deployCodeTo(
            "SnapflowEscrow.sol:SnapflowEscrow",
            abi.encode(IERC20(VECTOR_TOKEN), VECTOR_ADMIN, VECTOR_FEE_RECIPIENT, VECTOR_FEE_CAP_BPS, VECTOR_WINDOW),
            verifyingContract
        );
        SnapflowEscrow escrow = SnapflowEscrow(verifyingContract);
        Voucher[] memory vouchers = vectorVouchers();

        assertEq(vm.parseJsonAddress(json, ".signer"), vm.addr(VECTOR_SIGNER_KEY));
        for (uint256 i; i < vouchers.length; ++i) {
            string memory path = string.concat(".vouchers[", vm.toString(i), "]");
            bytes32 digest = escrow.voucherDigest(vouchers[i]);
            assertEq(vm.parseJsonBytes32(json, string.concat(path, ".digest")), digest);
            bytes memory signature = vm.parseJsonBytes(json, string.concat(path, ".signature"));
            assertEq(ECDSA.recover(digest, signature), vm.addr(VECTOR_SIGNER_KEY));
        }
        string[] memory leaseIds = vectorLeaseIds();
        for (uint256 i; i < leaseIds.length; ++i) {
            string memory path = string.concat(".channels[", vm.toString(i), "].channelId");
            assertEq(vm.parseJsonBytes32(json, path), vectorChannelId(leaseIds[i]));
        }
    }
}
