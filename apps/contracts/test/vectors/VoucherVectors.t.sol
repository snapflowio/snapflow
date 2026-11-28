// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { ECDSA } from "@openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin-contracts/utils/cryptography/MessageHashUtils.sol";
import { Test } from "forge-std/Test.sol";
import { SnapflowEscrow } from "../../src/SnapflowEscrow.sol";
import { EscrowHashing } from "../../src/libraries/EscrowHashing.sol";
import { Voucher } from "../../src/types/EscrowTypes.sol";
import { VoucherVectorsConfig } from "./VoucherVectorsConfig.sol";

contract VoucherVectors_Test is Test, VoucherVectorsConfig {
    struct Eip712Domain {
        string name;
        string version;
        uint256 chainId;
        address verifyingContract;
    }

    string private constant DOMAIN_TYPE =
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
    string private constant VOUCHER_TYPE =
        "Voucher(address customer,address host,address feeReceiver,uint16 feeBps,bytes32 salt,uint128 cumulativeAmount,uint64 timestamp,bytes32 metadata)";
    string private constant PAYOUT_ADDRESS_TYPE =
        "PayoutAddress(address host,address payout,uint256 nonce,uint256 deadline)";
    string private constant HOST_WITHDRAWAL_TYPE =
        "HostWithdrawal(address host,address payout,address relayer,uint256 relayFee,uint256 nonce,uint256 deadline)";
    uint256 private constant INVALID_SIGNATURE_COUNT = 4;

    string private json;
    SnapflowEscrow private escrow;

    function setUp() external {
        vm.chainId(VECTOR_CHAIN_ID);
        json = vm.readFile(VECTORS_PATH);
        address verifyingContract = vm.parseJsonAddress(json, ".verifyingContract");
        deployCodeTo("SnapflowEscrow.sol:SnapflowEscrow", vectorConstructorArgs(), verifyingContract);
        escrow = SnapflowEscrow(verifyingContract);
    }

    function test_Header() external view {
        assertEq(vm.parseJsonUint(json, ".version"), VECTORS_VERSION);
        assertEq(vm.parseJsonUint(json, ".chainId"), VECTOR_CHAIN_ID);
        assertEq(vm.parseJsonAddress(json, ".signer"), vm.addr(VECTOR_SIGNER_KEY));
        assertEq(vm.parseJsonUint(json, ".signerKey"), VECTOR_SIGNER_KEY);
        assertEq(vm.parseJsonAddress(json, ".host"), vm.addr(VECTOR_HOST_KEY));
        assertEq(vm.parseJsonUint(json, ".hostKey"), VECTOR_HOST_KEY);
        assertEq(VECTOR_HOST, vm.addr(VECTOR_HOST_KEY));
        (, string memory name, string memory version,,,,) = escrow.eip712Domain();
        assertEq(vm.parseJsonString(json, ".domainName"), name);
        assertEq(vm.parseJsonString(json, ".domainVersion"), version);
    }

    function test_TypeHashes() external view {
        assertEq(vm.parseJsonBytes32(json, ".typeHashes.voucher"), vm.eip712HashType(VOUCHER_TYPE));
        assertEq(vm.parseJsonBytes32(json, ".typeHashes.payoutAddress"), vm.eip712HashType(PAYOUT_ADDRESS_TYPE));
        assertEq(vm.parseJsonBytes32(json, ".typeHashes.hostWithdrawal"), vm.eip712HashType(HOST_WITHDRAWAL_TYPE));
        assertEq(
            vm.parseJsonBytes32(json, ".typeHashes.depositAuthorizationTag"), EscrowHashing.DEPOSIT_AUTHORIZATION_TAG
        );
    }

    function test_Vouchers() external view {
        (string[] memory names, Voucher[] memory vouchers) = vectorVouchers();
        for (uint256 i; i < vouchers.length; ++i) {
            Voucher memory voucher = vouchers[i];
            string memory path = _entry(".vouchers", i);
            assertEq(vm.parseJsonString(json, string.concat(path, ".name")), names[i]);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".customer")), voucher.customer);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".host")), voucher.host);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".feeReceiver")), voucher.feeReceiver);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".feeBps")), voucher.feeBps);
            assertEq(vm.parseJsonBytes32(json, string.concat(path, ".salt")), voucher.salt);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".cumulativeAmount")), voucher.cumulativeAmount);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".timestamp")), voucher.timestamp);
            assertEq(vm.parseJsonBytes32(json, string.concat(path, ".metadata")), voucher.metadata);
            assertEq(vm.parseJsonBytes32(json, string.concat(path, ".channelId")), escrow.channelIdOf(voucher));

            bytes32 digest = escrow.voucherDigest(voucher);
            assertEq(digest, _typedDigest(VOUCHER_TYPE, abi.encode(voucher)));
            _assertSigned(path, digest, VECTOR_SIGNER_KEY);
        }
    }

    function test_SignerProofs() external view {
        (string[] memory names, address[] memory customers, uint256[] memory deadlines) = vectorSignerProofs();
        for (uint256 i; i < customers.length; ++i) {
            string memory path = _entry(".signerProofs", i);
            assertEq(vm.parseJsonString(json, string.concat(path, ".name")), names[i]);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".customer")), customers[i]);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".deadline")), deadlines[i]);
            _assertSigned(
                path, EscrowHashing.signerProofDigest(address(escrow), deadlines[i], customers[i]), VECTOR_SIGNER_KEY
            );
        }
    }

    function test_HostWithdrawals() external view {
        (string[] memory names, HostWithdrawalVector[] memory withdrawals) = vectorHostWithdrawals();
        for (uint256 i; i < withdrawals.length; ++i) {
            string memory path = _entry(".hostWithdrawals", i);
            HostWithdrawalVector memory withdrawal = withdrawals[i];
            assertEq(vm.parseJsonString(json, string.concat(path, ".name")), names[i]);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".host")), withdrawal.host);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".payout")), withdrawal.payout);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".relayer")), withdrawal.relayer);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".relayFee")), withdrawal.relayFee);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".nonce")), withdrawal.nonce);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".deadline")), withdrawal.deadline);
            bytes32 digest = escrow.hostWithdrawalDigest(
                withdrawal.host,
                withdrawal.payout,
                withdrawal.relayer,
                withdrawal.relayFee,
                withdrawal.nonce,
                withdrawal.deadline
            );
            assertEq(digest, _typedDigest(HOST_WITHDRAWAL_TYPE, abi.encode(withdrawal)));
            _assertSigned(path, digest, VECTOR_HOST_KEY);
        }
    }

    function test_PayoutAddresses() external view {
        (string[] memory names, PayoutAddressVector[] memory changes) = vectorPayoutAddresses();
        for (uint256 i; i < changes.length; ++i) {
            string memory path = _entry(".payoutAddresses", i);
            PayoutAddressVector memory change = changes[i];
            assertEq(vm.parseJsonString(json, string.concat(path, ".name")), names[i]);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".host")), change.host);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".payout")), change.payout);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".nonce")), change.nonce);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".deadline")), change.deadline);
            bytes32 digest = escrow.payoutAddressDigest(change.host, change.payout, change.nonce, change.deadline);
            assertEq(digest, _typedDigest(PAYOUT_ADDRESS_TYPE, abi.encode(change)));
            _assertSigned(path, digest, VECTOR_HOST_KEY);
        }
    }

    function test_DepositNonces() external view {
        (string[] memory names, DepositNonceVector[] memory deposits) = vectorDepositNonces();
        for (uint256 i; i < deposits.length; ++i) {
            string memory path = _entry(".depositNonces", i);
            DepositNonceVector memory deposit = deposits[i];
            assertEq(vm.parseJsonString(json, string.concat(path, ".name")), names[i]);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".payer")), deposit.payer);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".customer")), deposit.customer);
            assertEq(vm.parseJsonAddress(json, string.concat(path, ".relayer")), deposit.relayer);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".amount")), deposit.amount);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".relayFee")), deposit.relayFee);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".validAfter")), deposit.validAfter);
            assertEq(vm.parseJsonUint(json, string.concat(path, ".validBefore")), deposit.validBefore);
            assertEq(vm.parseJsonBytes32(json, string.concat(path, ".salt")), deposit.salt);
            assertEq(
                vm.parseJsonBytes32(json, string.concat(path, ".nonce")), vectorDepositNonce(address(escrow), deposit)
            );
        }
    }

    function test_InvalidVoucherSignaturesAreRejected() external view {
        (, Voucher[] memory vouchers) = vectorVouchers();
        address signer = vm.addr(VECTOR_SIGNER_KEY);
        assertFalse(vm.keyExistsJson(json, _entry(".invalidVoucherSignatures", INVALID_SIGNATURE_COUNT)));
        for (uint256 i; i < INVALID_SIGNATURE_COUNT; ++i) {
            string memory path = _entry(".invalidVoucherSignatures", i);
            Voucher memory voucher = vouchers[vm.parseJsonUint(json, string.concat(path, ".voucher"))];
            bytes memory signature = vm.parseJsonBytes(json, string.concat(path, ".signature"));
            (address recovered, ECDSA.RecoverError recoverError,) =
                ECDSA.tryRecover(escrow.voucherDigest(voucher), signature);
            assertTrue(
                recoverError != ECDSA.RecoverError.NoError || recovered != signer,
                vm.parseJsonString(json, string.concat(path, ".name"))
            );
        }
    }

    function _typedDigest(string memory structType, bytes memory encodedStruct) private view returns (bytes32) {
        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) =
            escrow.eip712Domain();
        bytes32 domainSeparator =
            vm.eip712HashStruct(DOMAIN_TYPE, abi.encode(Eip712Domain(name, version, chainId, verifyingContract)));
        return MessageHashUtils.toTypedDataHash(domainSeparator, vm.eip712HashStruct(structType, encodedStruct));
    }

    function _assertSigned(string memory path, bytes32 digest, uint256 key) private view {
        assertEq(vm.parseJsonBytes32(json, string.concat(path, ".digest")), digest);
        bytes memory signature = vm.parseJsonBytes(json, string.concat(path, ".signature"));
        assertEq(ECDSA.recover(digest, signature), vm.addr(key));
    }

    function _entry(string memory array, uint256 index) private pure returns (string memory) {
        return string.concat(array, "[", vm.toString(index), "]");
    }
}
