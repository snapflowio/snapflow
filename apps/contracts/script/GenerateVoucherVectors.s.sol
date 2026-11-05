// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { Script } from "forge-std/Script.sol";
import { SnapflowEscrow } from "../src/SnapflowEscrow.sol";
import { Voucher } from "../src/types/EscrowTypes.sol";
import { VoucherVectorsConfig } from "../test/vectors/VoucherVectorsConfig.sol";

/// @notice Writes EIP-712 voucher test vectors (digest and signature) that the Solidity, TypeScript and Go code all
/// check byte for byte. Run with `moon run contracts:vectors` after any change to the voucher layout.
contract GenerateVoucherVectors is Script, VoucherVectorsConfig {
    function run() external {
        vm.chainId(VECTOR_CHAIN_ID);
        SnapflowEscrow escrow = new SnapflowEscrow(
            IERC20(VECTOR_TOKEN), VECTOR_ADMIN, VECTOR_FEE_RECIPIENT, VECTOR_FEE_CAP_BPS, VECTOR_WINDOW
        );

        Voucher[] memory vouchers = vectorVouchers();
        string memory entries;
        for (uint256 i; i < vouchers.length; ++i) {
            bytes32 digest = escrow.voucherDigest(vouchers[i]);
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(VECTOR_SIGNER_KEY, digest);
            string memory separator = i == 0 ? "" : ",";
            entries = string.concat(entries, separator, _entry(vouchers[i], digest, abi.encodePacked(r, s, v)));
        }
        string memory json = string.concat(
            "{",
            _field("chainId", vm.toString(VECTOR_CHAIN_ID)),
            ",",
            _field("verifyingContract", _quoted(vm.toString(address(escrow)))),
            ",",
            _field("signer", _quoted(vm.toString(vm.addr(VECTOR_SIGNER_KEY)))),
            ",",
            _field("signerKey", _quoted(vm.toString(bytes32(VECTOR_SIGNER_KEY)))),
            ",",
            _field("vouchers", string.concat("[", entries, "]")),
            ",",
            _field("channels", _channels()),
            "}"
        );
        vm.writeJson(json, VECTORS_PATH);
    }

    function _entry(
        Voucher memory voucher,
        bytes32 digest,
        bytes memory signature
    )
        private
        pure
        returns (string memory)
    {
        string memory head = string.concat(
            _field("channelId", _quoted(vm.toString(voucher.channelId))),
            ",",
            _field("customer", _quoted(vm.toString(voucher.customer))),
            ",",
            _field("host", _quoted(vm.toString(voucher.host))),
            ",",
            _field("hostAmount", _quoted(vm.toString(voucher.hostAmount))),
            ",",
            _field("feeAmount", _quoted(vm.toString(voucher.feeAmount))),
            ","
        );
        string memory tail = string.concat(
            _field("serviceAmount", _quoted(vm.toString(voucher.serviceAmount))),
            ",",
            _field("sequence", _quoted(vm.toString(voucher.sequence))),
            ",",
            _field("expiry", _quoted(vm.toString(voucher.expiry))),
            ",",
            _field("digest", _quoted(vm.toString(digest))),
            ",",
            _field("signature", _quoted(vm.toString(signature)))
        );
        return string.concat("{", head, tail, "}");
    }

    function _channels() private pure returns (string memory channels) {
        string[] memory leaseIds = vectorLeaseIds();
        for (uint256 i; i < leaseIds.length; ++i) {
            Voucher memory parties = vectorVouchers()[0];
            string memory separator = i == 0 ? "" : ",";
            channels = string.concat(
                channels,
                separator,
                "{",
                _field("customer", _quoted(vm.toString(parties.customer))),
                ",",
                _field("host", _quoted(vm.toString(parties.host))),
                ",",
                _field("leaseId", _quoted(leaseIds[i])),
                ",",
                _field("channelId", _quoted(vm.toString(vectorChannelId(leaseIds[i])))),
                "}"
            );
        }
        return string.concat("[", channels, "]");
    }

    function _field(string memory name, string memory value) private pure returns (string memory) {
        return string.concat(_quoted(name), ":", value);
    }

    function _quoted(string memory value) private pure returns (string memory) {
        return string.concat("\"", value, "\"");
    }
}
