// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { ISnapflowEscrow } from "../../../src/interfaces/ISnapflowEscrow.sol";
import { SignedVoucher, Voucher } from "../../../src/types/EscrowTypes.sol";
import { Base_Test } from "../../Base.t.sol";

contract Claim_Fuzz_Test is Base_Test {
    function setUp() public override {
        super.setUp();
        _deposit(customer.addr, DEPOSIT);
    }

    /// @dev Two cumulative vouchers always pay exactly the final amounts, split between host and platform.
    function testFuzz_CumulativeClaimsPayFinalAmounts(
        uint256 firstHost,
        uint256 secondHost,
        uint16 feeBps,
        uint256 service
    )
        external
    {
        feeBps = uint16(bound(feeBps, 0, FEE_CAP_BPS));
        uint256 maxHost = DEPOSIT * BPS / (BPS + FEE_CAP_BPS) / 2;
        firstHost = bound(firstHost, 1, maxHost);
        secondHost = bound(secondHost, firstHost, maxHost);
        service = bound(service, 0, SERVICE_AMOUNT);

        escrow.claim(_sign(_custom(firstHost, feeBps, service, FIRST_SEQUENCE), customer));
        uint256 secondFee = secondHost * feeBps / BPS;
        Voucher memory second = _custom(secondHost, feeBps, service, SECOND_SEQUENCE);
        SignedVoucher memory pending = _sign(second, customer);
        if (secondHost == firstHost && secondFee == firstHost * feeBps / BPS) {
            vm.expectRevert(ISnapflowEscrow.ZeroAmount.selector);
        }
        escrow.claim(pending);

        assertEq(usdc.balanceOf(host), escrow.channelOf(CHANNEL_ID).hostClaimed);
        assertEq(
            usdc.balanceOf(platform),
            escrow.channelOf(CHANNEL_ID).feeClaimed + escrow.channelOf(CHANNEL_ID).serviceClaimed
        );
        assertEq(escrow.balanceOf(customer.addr) + usdc.balanceOf(host) + usdc.balanceOf(platform), DEPOSIT);
    }

    /// @dev Any fee above the cap on the increase is rejected, whatever the amounts.
    function testFuzz_RevertWhen_FeeAboveCap(uint256 hostAmount, uint256 excess) external {
        hostAmount = bound(hostAmount, 1, DEPOSIT / 2);
        uint256 allowed = (hostAmount * FEE_CAP_BPS + BPS - 1) / BPS;
        excess = bound(excess, 1, hostAmount);
        Voucher memory voucher = _custom(hostAmount, 0, 0, FIRST_SEQUENCE);
        voucher.feeAmount = allowed + excess;

        SignedVoucher memory pending = _sign(voucher, customer);
        vm.expectRevert(abi.encodeWithSelector(ISnapflowEscrow.FeeAboveCap.selector, voucher.feeAmount, allowed));
        escrow.claim(pending);
    }

    function _custom(
        uint256 hostAmount,
        uint16 feeBps,
        uint256 service,
        uint64 sequence
    )
        private
        view
        returns (Voucher memory voucher)
    {
        voucher = _voucher(CHANNEL_ID, hostAmount, service, sequence);
        voucher.feeAmount = hostAmount * feeBps / BPS;
    }
}
