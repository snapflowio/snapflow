// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { ISnapflowEscrow } from "../../../src/interfaces/ISnapflowEscrow.sol";
import { WithdrawalRequest } from "../../../src/types/EscrowTypes.sol";
import { Base_Test } from "../../Base.t.sol";

contract Withdraw_Test is Base_Test {
    function setUp() public override {
        super.setUp();
        _deposit(customer.addr, DEPOSIT);
    }

    function test_Withdraw_ReturnsFundsAfterDisputeWindow() external {
        _request(DEPOSIT);
        vm.warp(block.timestamp + DISPUTE_WINDOW);
        uint256 before = usdc.balanceOf(customer.addr);

        vm.prank(customer.addr);
        escrow.withdraw();

        assertEq(usdc.balanceOf(customer.addr), before + DEPOSIT);
        assertEq(escrow.balanceOf(customer.addr), 0);
        assertEq(escrow.withdrawalOf(customer.addr).readyAt, 0);
    }

    function test_Withdraw_HostCanStillClaimDuringWindow() external {
        _authorizeSession();
        _request(DEPOSIT);
        escrow.claim(_signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE));
        vm.warp(block.timestamp + DISPUTE_WINDOW);
        uint256 remaining = escrow.balanceOf(customer.addr);

        vm.prank(customer.addr);
        escrow.withdraw();

        assertEq(usdc.balanceOf(host), HOST_AMOUNT);
        assertEq(escrow.balanceOf(customer.addr), 0);
        assertLt(remaining, DEPOSIT);
    }

    function test_Withdraw_WorksWhilePaused() external {
        _request(DEPOSIT);
        vm.prank(pauser);
        escrow.pause();
        vm.warp(block.timestamp + DISPUTE_WINDOW);

        vm.prank(customer.addr);
        escrow.withdraw();

        assertEq(escrow.balanceOf(customer.addr), 0);
    }

    function test_CancelWithdrawal_ClearsRequest() external {
        _request(DEPOSIT);
        vm.prank(customer.addr);
        escrow.cancelWithdrawal();

        WithdrawalRequest memory request = escrow.withdrawalOf(customer.addr);
        assertEq(request.amount, 0);
    }

    function test_RevertWhen_WithdrawBeforeWindowEnds() external {
        _request(DEPOSIT);
        uint64 readyAt = escrow.withdrawalOf(customer.addr).readyAt;

        vm.prank(customer.addr);
        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.WithdrawalNotReady.selector, readyAt));
        escrow.withdraw();
    }

    function test_RevertWhen_NoRequest() external {
        vm.prank(customer.addr);
        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.NoWithdrawalRequested.selector, customer.addr));
        escrow.withdraw();
    }

    function test_RevertWhen_RequestExceedsBalance() external {
        vm.prank(customer.addr);
        vm.expectRevert(
            abi.encodeWithSelector(ISnapflowEscrow.InsufficientBalance.selector, customer.addr, DEPOSIT + 1, DEPOSIT)
        );
        escrow.requestWithdrawal(DEPOSIT + 1);
    }

    function test_RevertWhen_BlockedCustomerWithdraws() external {
        _request(DEPOSIT);
        vm.prank(compliance);
        escrow.blockAccount(customer.addr);
        vm.warp(block.timestamp + DISPUTE_WINDOW);

        vm.prank(customer.addr);
        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.AccountBlocked.selector, customer.addr));
        escrow.withdraw();
    }

    function _request(uint256 amount) private {
        vm.prank(customer.addr);
        escrow.requestWithdrawal(amount);
    }
}
