// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { console } from "forge-std/console.sol";
import { SnapflowEscrow } from "../src/SnapflowEscrow.sol";
import { EscrowRoles, EscrowWindows } from "../src/types/EscrowTypes.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";
import { EscrowDeployer } from "./base/EscrowDeployer.sol";

contract DeployLocal is EscrowDeployer {
    string private constant ACCOUNT_SEPARATOR = ",";

    bytes11 private constant USDC_SALT_LABEL = "mock-usdc";

    string private constant CREATEX_DEPLOYMENT_FILE = "script/createx/presigned-deployment.json";
    bytes32 private constant CREATEX_DEPLOYMENT_TX_HASH =
        0xb6274b80bc7cda162df89894c7748a5cb7ba2eaa6004183c41a1837c3b072f1e;

    address private constant CREATEX_DEPLOYER = 0xeD456e05CaAb11d66C4c797dD6c1D6f9A7F352b5;
    uint256 private constant CREATEX_DEPLOYMENT_GAS_LIMIT = 3_000_000;
    uint256 private constant CREATEX_DEPLOYMENT_GAS_PRICE = 100 gwei;

    error CreateXDeploymentChanged(bytes32 transactionHash);
    error CreateXFundingFailed();

    function run() external returns (MockUSDC usdc, SnapflowEscrow escrow) {
        address[] memory funded = vm.envAddress("LOCAL_FUNDED_ACCOUNTS", ACCOUNT_SEPARATOR);
        uint256 amount = vm.envUint("LOCAL_FUNDING_AMOUNT");
        EscrowWindows memory windows = _envWindows();

        vm.startBroadcast();
        if (address(CREATEX).code.length == 0) _deployCreateX();
        usdc = MockUSDC(predictAddress(msg.sender, USDC_SALT_LABEL));
        if (address(usdc).code.length == 0) {
            usdc = MockUSDC(_deployCreate3(USDC_SALT_LABEL, type(MockUSDC).creationCode));
        }
        escrow = SnapflowEscrow(predictEscrow(msg.sender));
        if (address(escrow).code.length == 0) {
            escrow = _deployEscrow(
                EscrowConfig({
                    token: IERC20(address(usdc)),
                    roles: EscrowRoles({
                        admin: msg.sender,
                        pauser: msg.sender,
                        guardian: vm.envOr("LOCAL_GUARDIAN", msg.sender),
                        claimsFreezer: msg.sender,
                        compliance: msg.sender
                    }),
                    windows: windows,
                    depositCaps: _envDepositCaps()
                }),
                vm.envOr("LOCAL_FEE_RECEIVER", msg.sender)
            );
            for (uint256 i; i < funded.length; ++i) {
                usdc.mint(funded[i], amount);
            }
        }
        vm.stopBroadcast();

        console.log("USDC", address(usdc));
        console.log("SnapflowEscrow", address(escrow));
    }

    function _deployCreateX() private {
        bytes memory transaction = vm.parseJsonBytes(vm.readFile(CREATEX_DEPLOYMENT_FILE), "$");
        if (keccak256(transaction) != CREATEX_DEPLOYMENT_TX_HASH) {
            revert CreateXDeploymentChanged(keccak256(transaction));
        }
        (bool funded,) = CREATEX_DEPLOYER.call{ value: CREATEX_DEPLOYMENT_GAS_LIMIT * CREATEX_DEPLOYMENT_GAS_PRICE }("");
        if (!funded) revert CreateXFundingFailed();
        vm.broadcastRawTransaction(transaction);
    }
}
