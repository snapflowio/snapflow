// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { CommonBase } from "forge-std/Base.sol";
import { StdCheats } from "forge-std/StdCheats.sol";
import { StdUtils } from "forge-std/StdUtils.sol";
import { SnapflowEscrow } from "../../../src/SnapflowEscrow.sol";
import { EscrowLimits } from "../../../src/libraries/EscrowLimits.sol";
import { Channel, SignedVoucher, Voucher } from "../../../src/types/EscrowTypes.sol";
import { MockUSDC } from "../../mocks/MockUSDC.sol";
import { Constants } from "../../utils/Constants.sol";

/// @notice Deploys an escrow and drives it through random deposits, claims, withdrawals and time jumps while
/// recording what moved. It builds its own escrow so Medusa, which only deploys contracts without constructor
/// arguments, can fuzz the same handler as Foundry.
contract EscrowHandler is CommonBase, StdCheats, StdUtils, Constants {
    uint256 private constant CUSTOMER_COUNT = 3;
    uint256 private constant HOST_COUNT = 2;
    uint256 private constant MAX_TIME_JUMP = 2 days;

    SnapflowEscrow public immutable escrow;
    MockUSDC public immutable usdc;
    address public immutable platform;

    address[] public customers;
    uint256[] private customerKeys;
    address[] public hosts;

    uint256 public deposited;
    uint256 public paidOut;
    uint256 public withdrawn;
    uint256 public feesOverAllowance;

    bytes32[] public channels;
    mapping(bytes32 channelId => uint256) private lastHostClaimed;

    constructor() {
        platform = makeAddr("platform");
        usdc = new MockUSDC();
        escrow = new SnapflowEscrow(IERC20(address(usdc)), makeAddr("admin"), platform, FEE_CAP_BPS, DISPUTE_WINDOW);
        for (uint256 i; i < CUSTOMER_COUNT; ++i) {
            (address account, uint256 key) = makeAddrAndKey(string.concat("invariant-customer-", vm.toString(i)));
            customers.push(account);
            customerKeys.push(key);
            usdc.mint(account, INITIAL_FUNDS);
            vm.prank(account);
            usdc.approve(address(escrow), type(uint256).max);
        }
        for (uint256 i; i < HOST_COUNT; ++i) {
            hosts.push(makeAddr(string.concat("invariant-host-", vm.toString(i))));
        }
    }

    function deposit(uint256 customerSeed, uint256 amount) external {
        address customer = customers[customerSeed % CUSTOMER_COUNT];
        amount = bound(amount, 1, DEPOSIT);
        vm.prank(customer);
        escrow.deposit(amount);
        deposited += amount;
    }

    function claim(uint256 customerSeed, uint256 hostSeed, uint256 increase, uint16 feeBps) external {
        uint256 index = customerSeed % CUSTOMER_COUNT;
        address customer = customers[index];
        address host = hosts[hostSeed % HOST_COUNT];
        bytes32 channelId = keccak256(abi.encode(customer, host));
        Channel memory channel = escrow.channelOf(channelId);
        feeBps = uint16(bound(feeBps, 0, EscrowLimits.MAX_FEE_BPS));

        uint256 balance = escrow.balanceOf(customer);
        uint256 maxIncrease = balance * BPS / (BPS + feeBps);
        if (maxIncrease == 0) return;
        increase = bound(increase, 1, maxIncrease);

        uint256 hostDelta = increase;
        uint256 feeDelta = hostDelta * feeBps / BPS;
        Voucher memory voucher = Voucher({
            channelId: channelId,
            customer: customer,
            host: host,
            hostAmount: channel.hostClaimed + hostDelta,
            feeAmount: channel.feeClaimed + feeDelta,
            serviceAmount: channel.serviceClaimed,
            sequence: channel.sequence + 1,
            expiry: uint64(block.timestamp) + VOUCHER_LIFETIME
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(customerKeys[index], escrow.voucherDigest(voucher));
        escrow.claim(SignedVoucher({ voucher: voucher, signer: customer, signature: abi.encodePacked(r, s, v) }));

        if (lastHostClaimed[channelId] == 0) channels.push(channelId);
        lastHostClaimed[channelId] = voucher.hostAmount;
        paidOut += hostDelta + feeDelta;
        if (feeDelta * BPS > hostDelta * escrow.feeCapBps() + BPS) feesOverAllowance += 1;
    }

    function requestWithdrawal(uint256 customerSeed, uint256 amount) external {
        address customer = customers[customerSeed % CUSTOMER_COUNT];
        uint256 balance = escrow.balanceOf(customer);
        if (balance == 0) return;
        vm.prank(customer);
        escrow.requestWithdrawal(bound(amount, 1, balance));
    }

    function withdraw(uint256 customerSeed) external {
        address customer = customers[customerSeed % CUSTOMER_COUNT];
        uint64 readyAt = escrow.withdrawalOf(customer).readyAt;
        if (readyAt == 0) return;
        if (block.timestamp < readyAt) vm.warp(readyAt);
        uint256 before = usdc.balanceOf(customer);
        vm.prank(customer);
        escrow.withdraw();
        withdrawn += usdc.balanceOf(customer) - before;
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1, MAX_TIME_JUMP));
    }

    function decreasedChannels() external view returns (uint256 decreased) {
        for (uint256 i; i < channels.length; ++i) {
            if (escrow.channelOf(channels[i]).hostClaimed < lastHostClaimed[channels[i]]) ++decreased;
        }
    }

    function customerCount() external pure returns (uint256) {
        return CUSTOMER_COUNT;
    }

    function hostCount() external pure returns (uint256) {
        return HOST_COUNT;
    }
}
