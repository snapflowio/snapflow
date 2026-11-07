// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { ISnapflowEscrow } from "../../../src/interfaces/ISnapflowEscrow.sol";
import { EscrowLimits } from "../../../src/libraries/EscrowLimits.sol";
import { SessionKey, SignedVoucher, Voucher } from "../../../src/types/EscrowTypes.sol";
import { Base_Test } from "../../Base.t.sol";

contract SessionKeys_Test is Base_Test {
    function setUp() public override {
        super.setUp();
        _deposit(customer.addr, DEPOSIT);
        _authorizeSession();
    }

    function test_SetSessionKey_StoresLimits() external view {
        SessionKey memory session = escrow.sessionKeyOf(customer.addr, sessionSigner.addr);
        assertEq(session.spendCap, SESSION_SPEND_CAP);
        assertEq(session.hourlyCap, SESSION_HOURLY_CAP);
        assertEq(session.activatedAt, block.timestamp);
        assertEq(session.spent, 0);
    }

    function test_RevokeSessionKey_StopsClaims() external {
        vm.prank(customer.addr);
        escrow.revokeSessionKey(sessionSigner.addr);

        SignedVoucher memory pending = _signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE);
        vm.expectRevert(
            abi.encodeWithSelector(ISnapflowEscrow.SessionKeyInactive.selector, customer.addr, sessionSigner.addr)
        );
        escrow.claim(pending);
    }

    function test_RevertWhen_SessionExpired() external {
        vm.warp(block.timestamp + SESSION_LIFETIME + 1);
        SignedVoucher memory signed = _signedVoucher(HOST_AMOUNT, FIRST_SEQUENCE);

        vm.expectRevert(
            abi.encodeWithSelector(ISnapflowEscrow.SessionKeyInactive.selector, customer.addr, sessionSigner.addr)
        );
        escrow.claim(signed);
    }

    function test_HourlyCap_AccruesSoBatchedClaimsFit() external {
        uint256 threeHours = uint256(SESSION_HOURLY_CAP) * 3;
        uint256 hostAmount = threeHours * BPS / (BPS + STANDARD_FEE_BPS);
        vm.warp(block.timestamp + 2 * EscrowLimits.SESSION_RATE_WINDOW);

        Voucher memory voucher = _voucher(CHANNEL_ID, hostAmount, 0, FIRST_SEQUENCE);
        escrow.claim(_sign(voucher, sessionSigner));

        assertEq(usdc.balanceOf(host), hostAmount);
    }

    function test_RevertWhen_HourlyCapExceeded() external {
        uint256 hostAmount = SESSION_HOURLY_CAP;
        uint256 total = hostAmount + _fee(hostAmount, STANDARD_FEE_BPS);

        SignedVoucher memory pending = _sign(_voucher(CHANNEL_ID, hostAmount, 0, FIRST_SEQUENCE), sessionSigner);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISnapflowEscrow.SessionHourlyCapExceeded.selector, sessionSigner.addr, total, SESSION_HOURLY_CAP
            )
        );
        escrow.claim(pending);
    }

    function test_RevertWhen_SpendCapExceeded() external {
        vm.warp(block.timestamp + SESSION_LIFETIME - 1);
        uint256 hostAmount = SESSION_SPEND_CAP;
        uint256 total = hostAmount + _fee(hostAmount, STANDARD_FEE_BPS);

        SignedVoucher memory pending = _sign(_voucher(CHANNEL_ID, hostAmount, 0, FIRST_SEQUENCE), sessionSigner);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISnapflowEscrow.SessionSpendCapExceeded.selector, sessionSigner.addr, total, SESSION_SPEND_CAP
            )
        );
        escrow.claim(pending);
    }

    function test_RevertWhen_KeyIsCustomer() external {
        vm.prank(customer.addr);
        vm.expectRevert(ISnapflowEscrow.InvalidSessionKey.selector);
        escrow.setSessionKey(customer.addr, SESSION_SPEND_CAP, SESSION_HOURLY_CAP, uint64(block.timestamp) + 1);
    }

    function test_RevertWhen_ExpiryInPast() external {
        vm.prank(customer.addr);
        vm.expectRevert(ISnapflowEscrow.InvalidSessionKey.selector);
        escrow.setSessionKey(sessionSigner.addr, SESSION_SPEND_CAP, SESSION_HOURLY_CAP, uint64(block.timestamp));
    }

    function test_RevertWhen_CapIsZero() external {
        vm.prank(customer.addr);
        vm.expectRevert(ISnapflowEscrow.ZeroAmount.selector);
        escrow.setSessionKey(sessionSigner.addr, 0, SESSION_HOURLY_CAP, uint64(block.timestamp) + 1);
    }
}
