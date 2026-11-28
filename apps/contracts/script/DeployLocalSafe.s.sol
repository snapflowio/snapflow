// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";

contract DeployLocalSafe is Script {
    string private constant DEPLOYMENT_DIRECTORY = "script/safe/";
    string private constant DEPLOYMENT_EXTENSION = ".json";

    string private constant SINGLETON_FACTORY_FILE = "script/safe/singleton-factory-31337.json";
    address private constant SINGLETON_FACTORY = 0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7;
    bytes32 private constant SINGLETON_FACTORY_TX_HASH =
        0x41a6b731f53cf45627c3976abcb9ecd52fb2142f8f6fbbff4e0bb54a9b3667bc;

    error SingletonFactoryDeploymentChanged(bytes32 transactionHash);
    error FundingFailed(address account);
    error DeploymentChanged(string name, address predicted);
    error DeploymentFailed(string name);

    function run() external {
        string[6] memory names = [
            "safe-l2",
            "safe-proxy-factory",
            "compatibility-fallback-handler",
            "multi-send-call-only",
            "safe-webauthn-signer-factory",
            "daimo-p256-verifier"
        ];
        vm.startBroadcast();
        if (SINGLETON_FACTORY.code.length == 0) _deploySingletonFactory();
        for (uint256 i; i < names.length; ++i) {
            _deploy(names[i]);
        }
        vm.stopBroadcast();
    }

    function _deploySingletonFactory() private {
        string memory deployment = vm.readFile(SINGLETON_FACTORY_FILE);
        bytes memory transaction = vm.parseJsonBytes(deployment, ".transaction");
        if (keccak256(transaction) != SINGLETON_FACTORY_TX_HASH) {
            revert SingletonFactoryDeploymentChanged(keccak256(transaction));
        }
        address signer = vm.parseJsonAddress(deployment, ".signerAddress");
        uint256 cost = vm.parseJsonUint(deployment, ".gasPrice") * vm.parseJsonUint(deployment, ".gasLimit");
        (bool funded,) = signer.call{ value: cost }("");
        if (!funded) revert FundingFailed(signer);
        vm.broadcastRawTransaction(transaction);
    }

    function _deploy(string memory name) private {
        string memory deployment = vm.readFile(string.concat(DEPLOYMENT_DIRECTORY, name, DEPLOYMENT_EXTENSION));
        address canonical = vm.parseJsonAddress(deployment, ".address");
        if (canonical.code.length != 0) return;
        address factory = vm.parseJsonAddress(deployment, ".factory");
        bytes32 salt = vm.parseJsonBytes32(deployment, ".salt");
        bytes memory initCode = vm.parseJsonBytes(deployment, ".initCode");
        address predicted = vm.computeCreate2Address(salt, keccak256(initCode), factory);
        if (predicted != canonical) revert DeploymentChanged(name, predicted);
        (bool deployed,) = factory.call(abi.encodePacked(salt, initCode));
        if (!deployed || canonical.code.length == 0) revert DeploymentFailed(name);
        console.log(name, canonical);
    }
}
