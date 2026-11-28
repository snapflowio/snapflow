// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { Script } from "forge-std/Script.sol";
import { SnapflowEscrow } from "../../src/SnapflowEscrow.sol";
import { EscrowHashing } from "../../src/libraries/EscrowHashing.sol";
import { Voucher } from "../../src/types/EscrowTypes.sol";
import { VoucherVectorsConfig } from "./VoucherVectorsConfig.sol";

contract GenerateVoucherVectors is Script, VoucherVectorsConfig {
    string private constant SEPARATOR = ",";
    uint8 private constant LEGACY_RECOVERY_OFFSET = 27;
    uint256 private constant COMPACT_PARITY_BIT = 255;
    uint256 private constant SIGNED_VOUCHER = 0;

    function run() external {
        vm.chainId(VECTOR_CHAIN_ID);
        address escrow = deployCode("SnapflowEscrow.sol:SnapflowEscrow", vectorConstructorArgs());
        string memory json = _header(escrow);
        json = _join(json, _field("typeHashes", _typeHashes()));
        json = _join(json, _field("vouchers", _vouchers(SnapflowEscrow(escrow))));
        json = _join(json, _field("signerProofs", _signerProofs(escrow)));
        json = _join(json, _field("hostWithdrawals", _hostWithdrawals(SnapflowEscrow(escrow))));
        json = _join(json, _field("payoutAddresses", _payoutAddresses(SnapflowEscrow(escrow))));
        json = _join(json, _field("depositNonces", _depositNonces(escrow)));
        json = _join(json, _field("invalidVoucherSignatures", _invalidVoucherSignatures(SnapflowEscrow(escrow))));
        vm.writeJson(_object(json), VECTORS_PATH);
    }

    function _header(address escrow) private view returns (string memory fields) {
        (, string memory name, string memory version,,,,) = SnapflowEscrow(escrow).eip712Domain();
        fields = _field("version", _number(VECTORS_VERSION));
        fields = _join(fields, _field("chainId", vm.toString(VECTOR_CHAIN_ID)));
        fields = _join(fields, _field("verifyingContract", _address(escrow)));
        fields = _join(fields, _field("domainName", _quoted(name)));
        fields = _join(fields, _field("domainVersion", _quoted(version)));
        fields = _join(fields, _field("signer", _address(vm.addr(VECTOR_SIGNER_KEY))));
        fields = _join(fields, _field("signerKey", _word(bytes32(VECTOR_SIGNER_KEY))));
        fields = _join(fields, _field("host", _address(VECTOR_HOST)));
        fields = _join(fields, _field("hostKey", _word(bytes32(VECTOR_HOST_KEY))));
    }

    function _typeHashes() private pure returns (string memory) {
        string memory fields = _field("voucher", _word(EscrowHashing.VOUCHER_TYPEHASH));
        fields = _join(fields, _field("payoutAddress", _word(EscrowHashing.PAYOUT_ADDRESS_TYPEHASH)));
        fields = _join(fields, _field("hostWithdrawal", _word(EscrowHashing.HOST_WITHDRAWAL_TYPEHASH)));
        fields = _join(fields, _field("depositAuthorizationTag", _word(EscrowHashing.DEPOSIT_AUTHORIZATION_TAG)));
        return _object(fields);
    }

    function _vouchers(SnapflowEscrow escrow) private view returns (string memory entries) {
        (string[] memory names, Voucher[] memory vouchers) = vectorVouchers();
        for (uint256 i; i < vouchers.length; ++i) {
            Voucher memory voucher = vouchers[i];
            string memory fields = _field("name", _quoted(names[i]));
            fields = _join(fields, _field("customer", _address(voucher.customer)));
            fields = _join(fields, _field("host", _address(voucher.host)));
            fields = _join(fields, _field("feeReceiver", _address(voucher.feeReceiver)));
            fields = _join(fields, _field("feeBps", _number(voucher.feeBps)));
            fields = _join(fields, _field("salt", _word(voucher.salt)));
            fields = _join(fields, _field("cumulativeAmount", _number(voucher.cumulativeAmount)));
            fields = _join(fields, _field("timestamp", _number(voucher.timestamp)));
            fields = _join(fields, _field("metadata", _word(voucher.metadata)));
            fields = _join(fields, _field("channelId", _word(escrow.channelIdOf(voucher))));
            fields = _join(fields, _signed(escrow.voucherDigest(voucher), VECTOR_SIGNER_KEY));
            entries = _append(entries, i, _object(fields));
        }
        return _array(entries);
    }

    function _signerProofs(address escrow) private view returns (string memory entries) {
        (string[] memory names, address[] memory customers, uint256[] memory deadlines) = vectorSignerProofs();
        for (uint256 i; i < customers.length; ++i) {
            string memory fields = _field("name", _quoted(names[i]));
            fields = _join(fields, _field("customer", _address(customers[i])));
            fields = _join(fields, _field("deadline", _number(deadlines[i])));
            bytes32 digest = EscrowHashing.signerProofDigest(escrow, deadlines[i], customers[i]);
            fields = _join(fields, _signed(digest, VECTOR_SIGNER_KEY));
            entries = _append(entries, i, _object(fields));
        }
        return _array(entries);
    }

    function _hostWithdrawals(SnapflowEscrow escrow) private view returns (string memory entries) {
        (string[] memory names, HostWithdrawalVector[] memory withdrawals) = vectorHostWithdrawals();
        for (uint256 i; i < withdrawals.length; ++i) {
            HostWithdrawalVector memory withdrawal = withdrawals[i];
            string memory fields = _field("name", _quoted(names[i]));
            fields = _join(fields, _field("host", _address(withdrawal.host)));
            fields = _join(fields, _field("payout", _address(withdrawal.payout)));
            fields = _join(fields, _field("relayer", _address(withdrawal.relayer)));
            fields = _join(fields, _field("relayFee", _number(withdrawal.relayFee)));
            fields = _join(fields, _field("nonce", _number(withdrawal.nonce)));
            fields = _join(fields, _field("deadline", _number(withdrawal.deadline)));
            bytes32 digest = escrow.hostWithdrawalDigest(
                withdrawal.host,
                withdrawal.payout,
                withdrawal.relayer,
                withdrawal.relayFee,
                withdrawal.nonce,
                withdrawal.deadline
            );
            fields = _join(fields, _signed(digest, VECTOR_HOST_KEY));
            entries = _append(entries, i, _object(fields));
        }
        return _array(entries);
    }

    function _payoutAddresses(SnapflowEscrow escrow) private view returns (string memory entries) {
        (string[] memory names, PayoutAddressVector[] memory changes) = vectorPayoutAddresses();
        for (uint256 i; i < changes.length; ++i) {
            PayoutAddressVector memory change = changes[i];
            string memory fields = _field("name", _quoted(names[i]));
            fields = _join(fields, _field("host", _address(change.host)));
            fields = _join(fields, _field("payout", _address(change.payout)));
            fields = _join(fields, _field("nonce", _number(change.nonce)));
            fields = _join(fields, _field("deadline", _number(change.deadline)));
            bytes32 digest = escrow.payoutAddressDigest(change.host, change.payout, change.nonce, change.deadline);
            fields = _join(fields, _signed(digest, VECTOR_HOST_KEY));
            entries = _append(entries, i, _object(fields));
        }
        return _array(entries);
    }

    function _depositNonces(address escrow) private view returns (string memory entries) {
        (string[] memory names, DepositNonceVector[] memory deposits) = vectorDepositNonces();
        for (uint256 i; i < deposits.length; ++i) {
            DepositNonceVector memory deposit = deposits[i];
            string memory fields = _field("name", _quoted(names[i]));
            fields = _join(fields, _field("payer", _address(deposit.payer)));
            fields = _join(fields, _field("customer", _address(deposit.customer)));
            fields = _join(fields, _field("relayer", _address(deposit.relayer)));
            fields = _join(fields, _field("amount", _number(deposit.amount)));
            fields = _join(fields, _field("relayFee", _number(deposit.relayFee)));
            fields = _join(fields, _field("validAfter", _number(deposit.validAfter)));
            fields = _join(fields, _field("validBefore", _number(deposit.validBefore)));
            fields = _join(fields, _field("salt", _word(deposit.salt)));
            fields = _join(fields, _field("nonce", _word(vectorDepositNonce(escrow, deposit))));
            entries = _append(entries, i, _object(fields));
        }
        return _array(entries);
    }

    function _invalidVoucherSignatures(SnapflowEscrow escrow) private returns (string memory) {
        (, Voucher[] memory vouchers) = vectorVouchers();
        Voucher memory voucher = vouchers[SIGNED_VOUCHER];
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(VECTOR_SIGNER_KEY, escrow.voucherDigest(voucher));
        uint8 recoveryId = v - LEGACY_RECOVERY_OFFSET;
        uint8 otherV = recoveryId == 0 ? LEGACY_RECOVERY_OFFSET + 1 : LEGACY_RECOVERY_OFFSET;
        bytes32 highS = bytes32(SECP256K1_ORDER - uint256(s));
        bytes32 compactS = bytes32(uint256(s) | (uint256(recoveryId) << COMPACT_PARITY_BIT));

        vm.chainId(OTHER_CHAIN_ID);
        (uint8 otherChainV, bytes32 otherChainR, bytes32 otherChainS) =
            vm.sign(VECTOR_SIGNER_KEY, escrow.voucherDigest(voucher));
        vm.chainId(VECTOR_CHAIN_ID);

        string memory entries = _invalid("s in the upper half of the curve order", abi.encodePacked(r, highS, otherV));
        entries = _join(entries, _invalid("recovery id 0 or 1", abi.encodePacked(r, s, recoveryId)));
        entries = _join(entries, _invalid("64-byte compact signature", abi.encodePacked(r, compactS)));
        entries = _join(
            entries, _invalid("signed for another chain", abi.encodePacked(otherChainR, otherChainS, otherChainV))
        );
        return _array(entries);
    }

    function _invalid(string memory name, bytes memory signature) private pure returns (string memory) {
        string memory fields = _field("name", _quoted(name));
        fields = _join(fields, _field("voucher", _number(SIGNED_VOUCHER)));
        fields = _join(fields, _field("signature", _quoted(vm.toString(signature))));
        return _object(fields);
    }

    function _signed(bytes32 digest, uint256 key) private pure returns (string memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return
            _join(_field("digest", _word(digest)), _field("signature", _quoted(vm.toString(abi.encodePacked(r, s, v)))));
    }

    function _append(string memory entries, uint256 index, string memory entry) private pure returns (string memory) {
        return index == 0 ? entry : _join(entries, entry);
    }

    function _join(string memory head, string memory tail) private pure returns (string memory) {
        return string.concat(head, SEPARATOR, tail);
    }

    function _object(string memory fields) private pure returns (string memory) {
        return string.concat("{", fields, "}");
    }

    function _array(string memory entries) private pure returns (string memory) {
        return string.concat("[", entries, "]");
    }

    function _field(string memory name, string memory value) private pure returns (string memory) {
        return string.concat(_quoted(name), ":", value);
    }

    function _address(address account) private pure returns (string memory) {
        return _quoted(vm.toString(account));
    }

    function _word(bytes32 word) private pure returns (string memory) {
        return _quoted(vm.toString(word));
    }

    function _number(uint256 value) private pure returns (string memory) {
        return _quoted(vm.toString(value));
    }

    function _quoted(string memory value) private pure returns (string memory) {
        return string.concat("\"", value, "\"");
    }
}
