// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { Script } from "forge-std/Script.sol";
import { ICreateX } from "./ICreateX.sol";

abstract contract DeterministicDeployer is Script {
    ICreateX internal constant CREATEX = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

    bytes internal constant CREATE3_PROXY_INITCODE = hex"67363d3d37363d34f03d5260086018f3";

    uint256 internal constant CREATE3_PROXY_NONCE = 1;

    bytes1 internal constant NO_CROSS_CHAIN_PROTECTION = 0x00;

    error CreateXMissing(address factory);
    error UnexpectedDeploymentAddress(address expected, address actual);
    error DeploymentHasNoCode(address deployment);

    function deploymentSalt(address deployer, bytes11 label) public pure returns (bytes32) {
        return bytes32(abi.encodePacked(deployer, NO_CROSS_CHAIN_PROTECTION, label));
    }

    function predictAddress(address deployer, bytes11 label) public pure returns (address) {
        address proxy = vm.computeCreate2Address(
            _guardedSalt(deployer, label), keccak256(CREATE3_PROXY_INITCODE), address(CREATEX)
        );
        return vm.computeCreateAddress(proxy, CREATE3_PROXY_NONCE);
    }

    function _deployCreate3(bytes11 label, bytes memory initCode) internal returns (address deployment) {
        if (address(CREATEX).code.length == 0) revert CreateXMissing(address(CREATEX));
        address predicted = predictAddress(msg.sender, label);
        address computed = CREATEX.computeCreate3Address(_guardedSalt(msg.sender, label));
        if (computed != predicted) revert UnexpectedDeploymentAddress(predicted, computed);

        deployment = CREATEX.deployCreate3(deploymentSalt(msg.sender, label), initCode);
        if (deployment != predicted) revert UnexpectedDeploymentAddress(predicted, deployment);
        if (deployment.code.length == 0) revert DeploymentHasNoCode(deployment);
    }

    function _guardedSalt(address deployer, bytes11 label) private pure returns (bytes32) {
        return keccak256(abi.encode(deployer, deploymentSalt(deployer, label)));
    }
}
