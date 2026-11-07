// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";
import { SnapflowEscrow } from "../src/SnapflowEscrow.sol";
import { SignedVoucher, Voucher } from "../src/types/EscrowTypes.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";
import { Constants } from "./utils/Constants.sol";

/// @notice Deploys the escrow with a mock USDC and named actors, and builds signed vouchers.
abstract contract Base_Test is Test, Constants {
    struct Actor {
        address addr;
        uint256 key;
    }

    MockUSDC internal usdc;
    SnapflowEscrow internal escrow;

    Actor internal customer;
    Actor internal sessionSigner;
    Actor internal stranger;
    address internal host;
    address internal platform;
    address internal admin;
    address internal compliance;
    address internal pauser;

    function setUp() public virtual {
        customer = _actor("customer");
        sessionSigner = _actor("session");
        stranger = _actor("stranger");
        host = makeAddr("host");
        platform = makeAddr("platform");
        admin = makeAddr("admin");
        compliance = makeAddr("compliance");
        pauser = makeAddr("pauser");

        usdc = new MockUSDC();
        escrow = new SnapflowEscrow(IERC20(address(usdc)), admin, platform, FEE_CAP_BPS, DISPUTE_WINDOW);
        vm.startPrank(admin);
        escrow.grantRole(escrow.COMPLIANCE_ROLE(), compliance);
        escrow.grantRole(escrow.PAUSER_ROLE(), pauser);
        vm.stopPrank();

        _fund(customer.addr);
        _fund(stranger.addr);
    }

    function _actor(string memory name) internal returns (Actor memory actor) {
        (actor.addr, actor.key) = makeAddrAndKey(name);
    }

    function _fund(address account) internal {
        usdc.mint(account, INITIAL_FUNDS);
        vm.prank(account);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _deposit(address account, uint256 amount) internal {
        vm.prank(account);
        escrow.deposit(amount);
    }

    function _authorizeSession() internal {
        vm.prank(customer.addr);
        escrow.setSessionKey(
            sessionSigner.addr, SESSION_SPEND_CAP, SESSION_HOURLY_CAP, uint64(block.timestamp) + SESSION_LIFETIME
        );
    }

    function _fee(uint256 hostAmount, uint16 bps) internal pure returns (uint256) {
        return hostAmount * bps / BPS;
    }

    function _voucher(
        bytes32 channelId,
        uint256 hostAmount,
        uint256 serviceAmount,
        uint64 sequence
    )
        internal
        view
        returns (Voucher memory)
    {
        return Voucher({
            channelId: channelId,
            customer: customer.addr,
            host: host,
            hostAmount: hostAmount,
            feeAmount: _fee(hostAmount, STANDARD_FEE_BPS),
            serviceAmount: serviceAmount,
            sequence: sequence,
            expiry: uint64(block.timestamp) + VOUCHER_LIFETIME
        });
    }

    function _sign(Voucher memory voucher, Actor memory signer) internal view returns (SignedVoucher memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer.key, escrow.voucherDigest(voucher));
        return SignedVoucher({ voucher: voucher, signer: signer.addr, signature: abi.encodePacked(r, s, v) });
    }

    function _signedVoucher(uint256 hostAmount, uint64 sequence) internal view returns (SignedVoucher memory) {
        return _sign(_voucher(CHANNEL_ID, hostAmount, SERVICE_AMOUNT, sequence), sessionSigner);
    }
}
