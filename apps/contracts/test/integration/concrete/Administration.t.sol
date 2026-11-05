// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { SnapflowEscrow } from "../../../src/SnapflowEscrow.sol";
import { ISnapflowEscrow } from "../../../src/interfaces/ISnapflowEscrow.sol";
import { EscrowLimits } from "../../../src/libraries/EscrowLimits.sol";
import { FeeCapChange } from "../../../src/types/EscrowTypes.sol";
import { Base_Test } from "../../Base.t.sol";

contract Administration_Test is Base_Test {
    uint16 private constant RAISED_FEE_CAP_BPS = EscrowLimits.MAX_FEE_BPS;

    function setUp() public override {
        super.setUp();
        vm.prank(admin);
        escrow.scheduleFeeCap(LOWER_FEE_CAP_BPS);
    }

    function test_LowerFeeCap_AppliesImmediately() external view {
        assertEq(escrow.feeCapBps(), LOWER_FEE_CAP_BPS);
    }

    function test_RaisedFeeCap_WaitsForTimelock() external {
        vm.prank(admin);
        escrow.scheduleFeeCap(RAISED_FEE_CAP_BPS);
        FeeCapChange memory pending = escrow.pendingFeeCap();

        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.FeeCapNotReady.selector, pending.effectiveAt));
        escrow.applyFeeCap();

        vm.warp(pending.effectiveAt);
        escrow.applyFeeCap();
        assertEq(escrow.feeCapBps(), RAISED_FEE_CAP_BPS);
    }

    function test_CancelFeeCapSchedule() external {
        vm.startPrank(admin);
        escrow.scheduleFeeCap(RAISED_FEE_CAP_BPS);
        escrow.cancelFeeCapSchedule();
        vm.stopPrank();

        vm.expectRevert(ISnapflowEscrow.NoFeeCapScheduled.selector);
        escrow.applyFeeCap();
    }

    function test_RevertWhen_FeeCapAboveMaximum() external {
        uint16 tooHigh = EscrowLimits.MAX_FEE_BPS + 1;
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(ISnapflowEscrow.FeeCapTooHigh.selector, tooHigh, EscrowLimits.MAX_FEE_BPS)
        );
        escrow.scheduleFeeCap(tooHigh);
    }

    function test_RevertWhen_StrangerSchedulesFeeCap() external {
        vm.prank(stranger.addr);
        vm.expectRevert();
        escrow.scheduleFeeCap(LOWER_FEE_CAP_BPS);
    }

    function test_SetFeeRecipient_RedirectsFees() external {
        vm.prank(admin);
        escrow.setFeeRecipient(stranger.addr);
        assertEq(escrow.feeRecipient(), stranger.addr);
    }

    function test_BlockAndUnblock() external {
        vm.startPrank(compliance);
        escrow.blockAccount(customer.addr);
        assertTrue(escrow.isBlocked(customer.addr));
        escrow.unblockAccount(customer.addr);
        vm.stopPrank();
        assertFalse(escrow.isBlocked(customer.addr));
    }

    function test_RevertWhen_StrangerBlocks() external {
        vm.prank(stranger.addr);
        vm.expectRevert();
        escrow.blockAccount(customer.addr);
    }

    function test_RevertWhen_DisputeWindowOutOfRange() external {
        uint64 tooShort = EscrowLimits.MIN_DISPUTE_WINDOW - 1;
        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.DisputeWindowOutOfRange.selector, tooShort));
        new SnapflowEscrow(IERC20(address(usdc)), admin, platform, FEE_CAP_BPS, tooShort);
    }

    function test_RevertWhen_ConstructorFeeCapTooHigh() external {
        uint16 tooHigh = EscrowLimits.MAX_FEE_BPS + 1;
        vm.expectRevert(
            abi.encodeWithSelector(ISnapflowEscrow.FeeCapTooHigh.selector, tooHigh, EscrowLimits.MAX_FEE_BPS)
        );
        new SnapflowEscrow(IERC20(address(usdc)), admin, platform, tooHigh, DISPUTE_WINDOW);
    }
}
