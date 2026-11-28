// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { EscrowHashing } from "../../src/libraries/EscrowHashing.sol";
import { DepositCaps, EscrowRoles, EscrowWindows, Voucher } from "../../src/types/EscrowTypes.sol";

abstract contract VoucherVectorsConfig {
    struct HostWithdrawalVector {
        address host;
        address payout;
        address relayer;
        uint256 relayFee;
        uint256 nonce;
        uint256 deadline;
    }

    struct PayoutAddressVector {
        address host;
        address payout;
        uint256 nonce;
        uint256 deadline;
    }

    struct DepositNonceVector {
        address payer;
        address customer;
        address relayer;
        uint256 amount;
        uint256 relayFee;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 salt;
    }

    string internal constant VECTORS_PATH = "test/vectors/vouchers.json";
    uint256 internal constant VECTORS_VERSION = 2;
    uint256 internal constant VECTOR_CHAIN_ID = 84_532;
    uint256 internal constant OTHER_CHAIN_ID = 8453;
    address internal constant VECTOR_TOKEN = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    uint64 internal constant VECTOR_WINDOW = 24 hours;
    uint256 internal constant VECTOR_SIGNER_KEY = 0xA11CE;
    uint256 internal constant VECTOR_HOST_KEY = 0xB0B;
    address internal constant VECTOR_HOST = 0x0376AAc07Ad725E01357B1725B5ceC61aE10473c;

    address private constant VECTOR_ADMIN = 0x00000000000000000000000000000000000Ad1a1;
    address private constant VECTOR_PAUSER = 0x0000000000000000000000000000000000005a05;
    address private constant VECTOR_GUARDIAN = 0x0000000000000000000000000000000000006aD0;
    address private constant VECTOR_FREEZER = 0x000000000000000000000000000000000000f3E2;
    address private constant VECTOR_COMPLIANCE = 0x000000000000000000000000000000000000C0C0;
    address private constant VECTOR_CUSTOMER = 0x000000000000000000000000000000000000c057;
    address private constant VECTOR_FEE_RECEIVER = 0x000000000000000000000000000000000000FEE0;
    address private constant VECTOR_RELAYER = 0x0000000000000000000000000000000000000AE7;
    address private constant VECTOR_PAYER = 0x000000000000000000000000000000000000Ba7e;
    address private constant VECTOR_PAYOUT = 0x000000000000000000000000000000000000fA11;
    address private constant MAX_ADDRESS = address(type(uint160).max);
    uint64 private constant VECTOR_TIMESTAMP = 1_900_000_000;
    uint64 private constant VECTOR_TIMESTAMP_STEP = 60;
    uint256 private constant VECTOR_DEADLINE = 1_900_003_600;
    uint16 private constant VECTOR_FEE_BPS = 2000;
    uint256 private constant ONE_USDC = 1e6;
    uint128 private constant ODD_CUMULATIVE = 123_456_789;
    uint256 private constant RELAY_FEE = ONE_USDC / 10;
    uint256 private constant VOUCHER_COUNT = 3;
    uint256 private constant PROOF_COUNT = 2;
    uint256 private constant HOST_WITHDRAWAL_COUNT = 2;
    uint256 private constant PAYOUT_ADDRESS_COUNT = 2;
    uint256 private constant DEPOSIT_NONCE_COUNT = 2;

    function vectorConstructorArgs() internal pure returns (bytes memory) {
        return abi.encode(
            IERC20(VECTOR_TOKEN),
            EscrowRoles({
                admin: VECTOR_ADMIN,
                pauser: VECTOR_PAUSER,
                guardian: VECTOR_GUARDIAN,
                claimsFreezer: VECTOR_FREEZER,
                compliance: VECTOR_COMPLIANCE
            }),
            EscrowWindows({
                withdrawalDelay: VECTOR_WINDOW, claimWindow: VECTOR_WINDOW, signerThawPeriod: VECTOR_WINDOW
            }),
            DepositCaps({ total: 0, perAccount: 0 })
        );
    }

    function vectorVouchers() internal pure returns (string[] memory names, Voucher[] memory vouchers) {
        names = new string[](VOUCHER_COUNT);
        vouchers = new Voucher[](VOUCHER_COUNT);
        names[0] = "standard fee";
        vouchers[0] = Voucher({
            customer: VECTOR_CUSTOMER,
            host: VECTOR_HOST,
            feeReceiver: VECTOR_FEE_RECEIVER,
            feeBps: VECTOR_FEE_BPS,
            salt: bytes32(0),
            cumulativeAmount: uint128(ONE_USDC),
            timestamp: VECTOR_TIMESTAMP,
            metadata: bytes32(0)
        });
        names[1] = "no fee with salt and metadata";
        vouchers[1] = Voucher({
            customer: VECTOR_CUSTOMER,
            host: VECTOR_HOST,
            feeReceiver: address(0),
            feeBps: 0,
            salt: keccak256("channel-salt"),
            cumulativeAmount: ODD_CUMULATIVE,
            timestamp: VECTOR_TIMESTAMP + VECTOR_TIMESTAMP_STEP,
            metadata: keccak256("receipt-chain-head")
        });
        names[2] = "largest values";
        vouchers[2] = Voucher({
            customer: MAX_ADDRESS,
            host: MAX_ADDRESS,
            feeReceiver: MAX_ADDRESS,
            feeBps: type(uint16).max,
            salt: bytes32(type(uint256).max),
            cumulativeAmount: type(uint128).max,
            timestamp: type(uint64).max,
            metadata: bytes32(type(uint256).max)
        });
    }

    function vectorSignerProofs()
        internal
        pure
        returns (string[] memory names, address[] memory customers, uint256[] memory deadlines)
    {
        names = new string[](PROOF_COUNT);
        customers = new address[](PROOF_COUNT);
        deadlines = new uint256[](PROOF_COUNT);
        names[0] = "customer with deadline";
        customers[0] = VECTOR_CUSTOMER;
        deadlines[0] = VECTOR_DEADLINE;
        names[1] = "largest deadline";
        customers[1] = VECTOR_PAYER;
        deadlines[1] = type(uint256).max;
    }

    function vectorHostWithdrawals()
        internal
        pure
        returns (string[] memory names, HostWithdrawalVector[] memory withdrawals)
    {
        names = new string[](HOST_WITHDRAWAL_COUNT);
        withdrawals = new HostWithdrawalVector[](HOST_WITHDRAWAL_COUNT);
        names[0] = "first withdrawal with relay fee";
        withdrawals[0] = HostWithdrawalVector({
            host: VECTOR_HOST,
            payout: VECTOR_PAYOUT,
            relayer: VECTOR_RELAYER,
            relayFee: RELAY_FEE,
            nonce: 0,
            deadline: VECTOR_DEADLINE
        });
        names[1] = "largest values";
        withdrawals[1] = HostWithdrawalVector({
            host: VECTOR_HOST,
            payout: MAX_ADDRESS,
            relayer: MAX_ADDRESS,
            relayFee: type(uint256).max,
            nonce: type(uint256).max,
            deadline: type(uint256).max
        });
    }

    function vectorPayoutAddresses()
        internal
        pure
        returns (string[] memory names, PayoutAddressVector[] memory changes)
    {
        names = new string[](PAYOUT_ADDRESS_COUNT);
        changes = new PayoutAddressVector[](PAYOUT_ADDRESS_COUNT);
        names[0] = "first change";
        changes[0] =
            PayoutAddressVector({ host: VECTOR_HOST, payout: VECTOR_PAYOUT, nonce: 0, deadline: VECTOR_DEADLINE });
        names[1] = "largest nonce and deadline";
        changes[1] = PayoutAddressVector({
            host: VECTOR_HOST, payout: VECTOR_CUSTOMER, nonce: type(uint256).max, deadline: type(uint256).max
        });
    }

    function vectorDepositNonces() internal pure returns (string[] memory names, DepositNonceVector[] memory deposits) {
        names = new string[](DEPOSIT_NONCE_COUNT);
        deposits = new DepositNonceVector[](DEPOSIT_NONCE_COUNT);
        names[0] = "self-funded without relay fee";
        deposits[0] = DepositNonceVector({
            payer: VECTOR_CUSTOMER,
            customer: VECTOR_CUSTOMER,
            relayer: VECTOR_CUSTOMER,
            amount: 25 * ONE_USDC,
            relayFee: 0,
            validAfter: 0,
            validBefore: VECTOR_DEADLINE,
            salt: bytes32(0)
        });
        names[1] = "relayed at the largest values";
        deposits[1] = DepositNonceVector({
            payer: VECTOR_PAYER,
            customer: VECTOR_CUSTOMER,
            relayer: VECTOR_RELAYER,
            amount: type(uint256).max,
            relayFee: RELAY_FEE,
            validAfter: VECTOR_TIMESTAMP,
            validBefore: type(uint256).max,
            salt: keccak256("deposit-salt")
        });
    }

    function vectorDepositNonce(address escrow, DepositNonceVector memory deposit) internal view returns (bytes32) {
        return EscrowHashing.depositNonce(
            escrow,
            deposit.payer,
            deposit.customer,
            deposit.relayer,
            deposit.amount,
            deposit.relayFee,
            deposit.validAfter,
            deposit.validBefore,
            deposit.salt
        );
    }
}
