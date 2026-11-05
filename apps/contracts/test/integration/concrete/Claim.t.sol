// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { ISnapflowEscrow } from "../../../src/interfaces/ISnapflowEscrow.sol";
import { Channel, SignedVoucher, Voucher } from "../../../src/types/EscrowTypes.sol";
import { Base_Test } from "../../Base.t.sol";

contract Claim_Test is Base_Test {
    function setUp() public override {
        super.setUp();
        _deposit(customer.addr, DEPOSIT);
        _authorizeSession();
    }

    function test_Claim_PaysHostFullPriceAndPlatformItsFee() external {
        uint256 fee = _fee(HOST_AMOUNT, STANDARD_FEE_BPS);
        vm.expectEmit(address(escrow));
        emit ISnapflowEscrow.Claimed(CHANNEL_ID, customer.addr, host, HOST_AMOUNT, fee, SERVICE_AMOUNT, FIRST_SEQUENCE);
        escrow.claim(_signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE));

        assertEq(usdc.balanceOf(host), HOST_AMOUNT);
        assertEq(usdc.balanceOf(platform), fee + SERVICE_AMOUNT);
        assertEq(escrow.balanceOf(customer.addr), DEPOSIT - HOST_AMOUNT - fee - SERVICE_AMOUNT);
    }

    function test_Claim_PaysOnlyTheIncreaseOfACumulativeVoucher() external {
        escrow.claim(_signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE));
        escrow.claim(_signedVoucher(HOST_AMOUNT * 2, SECOND_SEQUENCE));

        assertEq(usdc.balanceOf(host), HOST_AMOUNT * 2);
        Channel memory channel = escrow.channelOf(CHANNEL_ID);
        assertEq(channel.hostClaimed, HOST_AMOUNT * 2);
        assertEq(channel.sequence, SECOND_SEQUENCE);
    }

    function test_Claim_AcceptsVoucherSignedByCustomer() external {
        escrow.claim(_sign(_voucher(CHANNEL_ID, HOST_AMOUNT, SERVICE_AMOUNT, FIRST_SEQUENCE), customer));

        assertEq(usdc.balanceOf(host), HOST_AMOUNT);
        assertEq(escrow.sessionKeyOf(customer.addr, sessionSigner.addr).spent, 0);
    }

    function test_Claim_ChargesSessionKeyAllowance() external {
        escrow.claim(_signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE));

        uint256 total = HOST_AMOUNT + _fee(HOST_AMOUNT, STANDARD_FEE_BPS) + SERVICE_AMOUNT;
        assertEq(escrow.sessionKeyOf(customer.addr, sessionSigner.addr).spent, total);
    }

    function test_ClaimBatch_SettlesEveryChannel() external {
        SignedVoucher[] memory batch = new SignedVoucher[](2);
        batch[0] = _signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE);
        batch[1] = _sign(_voucher(OTHER_CHANNEL_ID, HOST_AMOUNT, 0, FIRST_SEQUENCE), sessionSigner);
        escrow.claimBatch(batch);

        assertEq(usdc.balanceOf(host), HOST_AMOUNT * 2);
    }

    function test_RevertWhen_BatchIsEmpty() external {
        vm.expectRevert(ISnapflowEscrow.EmptyBatch.selector);
        escrow.claimBatch(new SignedVoucher[](0));
    }

    function test_RevertWhen_VoucherReplayed() external {
        SignedVoucher memory signed = _signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE);
        escrow.claim(signed);

        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.StaleVoucher.selector, FIRST_SEQUENCE, FIRST_SEQUENCE));
        escrow.claim(signed);
    }

    function test_RevertWhen_AmountDecreases() external {
        escrow.claim(_signedVoucher(HOST_AMOUNT * 2, FIRST_SEQUENCE));

        SignedVoucher memory pending = _signedVoucher(HOST_AMOUNT, SECOND_SEQUENCE);
        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.AmountDecreased.selector, CHANNEL_ID));
        escrow.claim(pending);
    }

    function test_RevertWhen_NothingNewToPay() external {
        escrow.claim(_signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE));

        SignedVoucher memory pending = _signedVoucher(HOST_AMOUNT, SECOND_SEQUENCE);
        vm.expectRevert(ISnapflowEscrow.ZeroAmount.selector);
        escrow.claim(pending);
    }

    function test_RevertWhen_VoucherExpired() external {
        SignedVoucher memory signed = _signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE);
        vm.warp(signed.voucher.expiry + 1);

        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.VoucherExpired.selector, signed.voucher.expiry));
        escrow.claim(signed);
    }

    function test_RevertWhen_FeeAboveCap() external {
        Voucher memory voucher = _voucher(CHANNEL_ID, HOST_AMOUNT, 0, FIRST_SEQUENCE);
        voucher.feeAmount = _fee(HOST_AMOUNT, FEE_CAP_BPS) + 1;

        SignedVoucher memory pending = _sign(voucher, sessionSigner);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISnapflowEscrow.FeeAboveCap.selector, voucher.feeAmount, _fee(HOST_AMOUNT, FEE_CAP_BPS)
            )
        );
        escrow.claim(pending);
    }

    function test_RevertWhen_SignedByStranger() external {
        SignedVoucher memory signed = _sign(_voucher(CHANNEL_ID, HOST_AMOUNT, 0, FIRST_SEQUENCE), stranger);

        vm.expectRevert(
            abi.encodeWithSelector(ISnapflowEscrow.SessionKeyInactive.selector, customer.addr, stranger.addr)
        );
        escrow.claim(signed);
    }

    function test_RevertWhen_SignatureDoesNotMatchSigner() external {
        SignedVoucher memory signed = _signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE);
        signed.signer = stranger.addr;

        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.InvalidSignature.selector, stranger.addr));
        escrow.claim(signed);
    }

    function test_RevertWhen_ChannelReusedForOtherHost() external {
        escrow.claim(_signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE));
        Voucher memory voucher = _voucher(CHANNEL_ID, HOST_AMOUNT * 2, 0, SECOND_SEQUENCE);
        voucher.host = stranger.addr;

        SignedVoucher memory pending = _sign(voucher, sessionSigner);
        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.ChannelMismatch.selector, CHANNEL_ID));
        escrow.claim(pending);
    }

    function test_RevertWhen_BalanceTooLow() external {
        SignedVoucher memory signed = _sign(_voucher(CHANNEL_ID, DEPOSIT, 0, FIRST_SEQUENCE), customer);
        uint256 total = DEPOSIT + _fee(DEPOSIT, STANDARD_FEE_BPS);

        vm.expectRevert(
            abi.encodeWithSelector(ISnapflowEscrow.InsufficientBalance.selector, customer.addr, total, DEPOSIT)
        );
        escrow.claim(signed);
    }

    function test_RevertWhen_HostBlocked() external {
        vm.prank(compliance);
        escrow.blockAccount(host);

        SignedVoucher memory pending = _signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE);
        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.AccountBlocked.selector, host));
        escrow.claim(pending);
    }
}
