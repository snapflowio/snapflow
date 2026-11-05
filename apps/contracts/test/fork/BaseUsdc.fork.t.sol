// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";
import { SnapflowEscrow } from "../../src/SnapflowEscrow.sol";
import { SignedVoucher, Voucher } from "../../src/types/EscrowTypes.sol";
import { Constants } from "../utils/Constants.sol";

/// @notice Runs a deposit, claim and withdrawal against Circle's native USDC on a Base mainnet fork.
/// Skipped unless BASE_RPC_URL is set.
contract BaseUsdc_Fork_Test is Test, Constants {
    IERC20 private constant BASE_USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    string private constant RPC_ENV = "BASE_RPC_URL";

    SnapflowEscrow private escrow;
    address private customer;
    uint256 private customerKey;
    address private host;
    address private platform;

    function setUp() external {
        string memory rpc = vm.envOr(RPC_ENV, string(""));
        if (bytes(rpc).length == 0) vm.skip(true);
        vm.createSelectFork(rpc);

        (customer, customerKey) = makeAddrAndKey("fork-customer");
        host = makeAddr("fork-host");
        platform = makeAddr("fork-platform");
        escrow = new SnapflowEscrow(BASE_USDC, makeAddr("fork-admin"), platform, FEE_CAP_BPS, DISPUTE_WINDOW);
        deal(address(BASE_USDC), customer, DEPOSIT);
        vm.prank(customer);
        BASE_USDC.approve(address(escrow), DEPOSIT);
    }

    function testFork_DepositClaimWithdraw() external {
        vm.prank(customer);
        escrow.deposit(DEPOSIT);

        uint256 fee = HOST_AMOUNT * STANDARD_FEE_BPS / BPS;
        Voucher memory voucher = Voucher({
            channelId: CHANNEL_ID,
            customer: customer,
            host: host,
            hostAmount: HOST_AMOUNT,
            feeAmount: fee,
            serviceAmount: 0,
            sequence: FIRST_SEQUENCE,
            expiry: uint64(block.timestamp) + VOUCHER_LIFETIME
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customerKey, escrow.voucherDigest(voucher));
        escrow.claim(SignedVoucher({ voucher: voucher, signer: customer, signature: abi.encodePacked(r, s, v) }));
        assertEq(BASE_USDC.balanceOf(host), HOST_AMOUNT);
        assertEq(BASE_USDC.balanceOf(platform), fee);

        uint256 remaining = escrow.balanceOf(customer);
        vm.prank(customer);
        escrow.requestWithdrawal(remaining);
        vm.warp(block.timestamp + DISPUTE_WINDOW);
        vm.prank(customer);
        escrow.withdraw();
        assertEq(BASE_USDC.balanceOf(customer), remaining);
    }
}
