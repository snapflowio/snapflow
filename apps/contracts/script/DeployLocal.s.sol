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
import { MockUSDC } from "../test/mocks/MockUSDC.sol";
import { EscrowDeployer } from "./base/EscrowDeployer.sol";

/// @notice Development deployment on a local anvil chain, at the same deterministic addresses as everywhere else:
/// CreateX (from its keyless deployment transaction, as on a new public chain) when the chain lacks it, a mock USDC,
/// the escrow with the broadcaster holding every role, and test USDC minted to each address in LOCAL_FUNDED_ACCOUNTS
/// (comma separated).
///
/// Environment: ESCROW_FEE_RECIPIENT, ESCROW_FEE_CAP_BPS, ESCROW_DISPUTE_WINDOW_SECONDS, LOCAL_FUNDED_ACCOUNTS,
/// LOCAL_FUNDING_AMOUNT (base units).
contract DeployLocal is EscrowDeployer {
    string private constant ACCOUNT_SEPARATOR = ",";

    /// @dev Salt label of the mock USDC.
    bytes11 private constant USDC_SALT_LABEL = "mock-usdc";

    /// @dev CreateX's pre-signed, pre-EIP-155 deployment transaction with a 3,000,000 gas limit at 100 gwei, copied
    /// unchanged from https://github.com/pcaversaccio/createx/blob/24b8500489f828a10b3d1e6fb4fea7b67b91ae2d/scripts/
    /// presigned-createx-deployment-transactions/signed_serialised_transaction_gaslimit_3000000_.json; its hash is the
    /// transaction hash of every CreateX deployment made from it.
    string private constant CREATEX_DEPLOYMENT_FILE = "script/createx/presigned-deployment.json";
    bytes32 private constant CREATEX_DEPLOYMENT_TX_HASH =
        0xb6274b80bc7cda162df89894c7748a5cb7ba2eaa6004183c41a1837c3b072f1e;

    /// @dev The keyless account that signed the transaction above, and the ETH it needs for its gas.
    address private constant CREATEX_DEPLOYER = 0xeD456e05CaAb11d66C4c797dD6c1D6f9A7F352b5;
    uint256 private constant CREATEX_DEPLOYMENT_GAS_LIMIT = 3_000_000;
    uint256 private constant CREATEX_DEPLOYMENT_GAS_PRICE = 100 gwei;

    error CreateXDeploymentChanged(bytes32 transactionHash);
    error CreateXFundingFailed();

    function run() external returns (MockUSDC usdc, SnapflowEscrow escrow) {
        address[] memory funded = vm.envAddress("LOCAL_FUNDED_ACCOUNTS", ACCOUNT_SEPARATOR);
        uint256 amount = vm.envUint("LOCAL_FUNDING_AMOUNT");

        vm.startBroadcast();
        if (address(CREATEX).code.length == 0) _deployCreateX();
        usdc = MockUSDC(_deployCreate3(USDC_SALT_LABEL, type(MockUSDC).creationCode));
        escrow = _deployEscrow(
            EscrowConfig({
                token: IERC20(address(usdc)),
                feeRecipient: vm.envAddress("ESCROW_FEE_RECIPIENT"),
                compliance: msg.sender,
                pauser: msg.sender,
                feeCapBps: uint16(vm.envUint("ESCROW_FEE_CAP_BPS")),
                disputeWindow: uint64(vm.envUint("ESCROW_DISPUTE_WINDOW_SECONDS"))
            })
        );
        for (uint256 i; i < funded.length; ++i) {
            usdc.mint(funded[i], amount);
        }
        vm.stopBroadcast();

        console.log("USDC", address(usdc));
        console.log("SnapflowEscrow", address(escrow));
    }

    /// @dev Must run inside the broadcast: the funding transfer comes from the broadcaster.
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
