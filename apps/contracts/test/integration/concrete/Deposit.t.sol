// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { ISnapflowEscrow } from "../../../src/interfaces/ISnapflowEscrow.sol";
import { Base_Test } from "../../Base.t.sol";

contract Deposit_Test is Base_Test {
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    uint256 private constant PERMIT_LIFETIME = 1 hours;

    function test_Deposit_CreditsCallerAndMovesTokens() external {
        vm.expectEmit(address(escrow));
        emit ISnapflowEscrow.Deposited(customer.addr, customer.addr, DEPOSIT);
        _deposit(customer.addr, DEPOSIT);

        assertEq(escrow.balanceOf(customer.addr), DEPOSIT);
        assertEq(usdc.balanceOf(address(escrow)), DEPOSIT);
    }

    function test_DepositFor_CreditsBeneficiary() external {
        vm.prank(stranger.addr);
        escrow.depositFor(customer.addr, DEPOSIT);

        assertEq(escrow.balanceOf(customer.addr), DEPOSIT);
        assertEq(escrow.balanceOf(stranger.addr), 0);
    }

    function test_DepositWithPermit_NeedsNoApproval() external {
        address owner = customer.addr;
        vm.prank(owner);
        usdc.approve(address(escrow), 0);
        uint256 deadline = block.timestamp + PERMIT_LIFETIME;
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, owner, address(escrow), DEPOSIT, usdc.nonces(owner), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customer.key, digest);

        vm.prank(owner);
        escrow.depositWithPermit(DEPOSIT, deadline, v, r, s);

        assertEq(escrow.balanceOf(owner), DEPOSIT);
    }

    function test_RevertWhen_DepositIsZero() external {
        vm.expectRevert(ISnapflowEscrow.ZeroAmount.selector);
        _deposit(customer.addr, 0);
    }

    function test_RevertWhen_BeneficiaryIsZero() external {
        vm.prank(customer.addr);
        vm.expectRevert(ISnapflowEscrow.ZeroAddress.selector);
        escrow.depositFor(address(0), DEPOSIT);
    }

    function test_RevertWhen_DepositorIsBlocked() external {
        vm.prank(compliance);
        escrow.blockAccount(customer.addr);

        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.AccountBlocked.selector, customer.addr));
        _deposit(customer.addr, DEPOSIT);
    }

    function test_RevertWhen_Paused() external {
        vm.prank(pauser);
        escrow.pause();

        vm.expectRevert();
        _deposit(customer.addr, DEPOSIT);
    }
}
