// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { Script } from "forge-std/Script.sol";
import { ICreateX } from "../interfaces/ICreateX.sol";

/// @notice CREATE3 deployments through the CreateX factory, so a contract's address depends only on the deployer and a
/// named salt label: the same deployer gets the same address on every chain, whatever the constructor arguments.
///
/// Salts are permissioned (the first 20 bytes are the deployer, so nobody else can take the address on another chain)
/// without cross-chain redeploy protection (byte 21 is zero, so the chain id is not part of the address). See
/// https://github.com/pcaversaccio/createx#permissioned-deploy-protection-and-cross-chain-redeploy-protection.
abstract contract DeterministicDeployer is Script {
    /// @dev CreateX's canonical address on Base, Base Sepolia and every chain in
    /// https://github.com/pcaversaccio/createx#createx-deployments.
    ICreateX internal constant CREATEX = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

    /// @dev The CREATE2 proxy CreateX deploys for each CREATE3 deployment (CreateX.sol, deployCreate3).
    bytes internal constant CREATE3_PROXY_INITCODE = hex"67363d3d37363d34f03d5260086018f3";

    /// @dev A CREATE3 proxy creates the contract with its first and only nonce.
    uint256 internal constant CREATE3_PROXY_NONCE = 1;

    /// @dev Byte 21 of a CreateX salt: zero turns cross-chain redeploy protection off.
    bytes1 internal constant NO_CROSS_CHAIN_PROTECTION = 0x00;

    error CreateXMissing(address factory);
    error UnexpectedDeploymentAddress(address expected, address actual);
    error DeploymentHasNoCode(address deployment);

    /// @notice The salt `deployer` passes to CreateX for `label`.
    function deploymentSalt(address deployer, bytes11 label) public pure returns (bytes32) {
        return bytes32(abi.encodePacked(deployer, NO_CROSS_CHAIN_PROTECTION, label));
    }

    /// @notice The address `deployer` gets for `label` on any chain, computed offline the way CreateX does.
    function predictAddress(address deployer, bytes11 label) public pure returns (address) {
        address proxy = vm.computeCreate2Address(
            _guardedSalt(deployer, label), keccak256(CREATE3_PROXY_INITCODE), address(CREATEX)
        );
        return vm.computeCreateAddress(proxy, CREATE3_PROXY_NONCE);
    }

    /// @dev Deploys `initCode` with CREATE3 from the current broadcaster and checks it landed at the predicted
    /// address, which must also be what CreateX itself computes on this chain.
    function _deployCreate3(bytes11 label, bytes memory initCode) internal returns (address deployment) {
        if (address(CREATEX).code.length == 0) revert CreateXMissing(address(CREATEX));
        address predicted = predictAddress(msg.sender, label);
        address computed = CREATEX.computeCreate3Address(_guardedSalt(msg.sender, label));
        if (computed != predicted) revert UnexpectedDeploymentAddress(predicted, computed);

        deployment = CREATEX.deployCreate3(deploymentSalt(msg.sender, label), initCode);
        if (deployment != predicted) revert UnexpectedDeploymentAddress(predicted, deployment);
        if (deployment.code.length == 0) revert DeploymentHasNoCode(deployment);
    }

    /// @dev What CreateX hashes a permissioned salt without cross-chain protection into (CreateX.sol, _guard).
    function _guardedSalt(address deployer, bytes11 label) private pure returns (bytes32) {
        return keccak256(abi.encode(deployer, deploymentSalt(deployer, label)));
    }
}
