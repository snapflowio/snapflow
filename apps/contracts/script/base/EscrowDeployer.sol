// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { SafeCast } from "@openzeppelin-contracts/utils/math/SafeCast.sol";
import { VmSafe } from "forge-std/Vm.sol";
import { SnapflowEscrow } from "../../src/SnapflowEscrow.sol";
import { EscrowLimits } from "../../src/libraries/EscrowLimits.sol";
import { DepositCaps, EscrowRoles, EscrowWindows } from "../../src/types/EscrowTypes.sol";
import { DeterministicDeployer } from "./DeterministicDeployer.sol";

abstract contract EscrowDeployer is DeterministicDeployer {
    bytes11 internal constant ESCROW_SALT_LABEL = "escrow.v6";

    uint64 internal constant DEFAULT_WITHDRAWAL_DELAY = 24 hours;
    uint64 internal constant DEFAULT_CLAIM_WINDOW = 24 hours;

    string private constant REGISTRY_DIRECTORY = "deployments/";
    string private constant REGISTRY_EXTENSION = ".json";

    struct EscrowConfig {
        IERC20 token;
        EscrowRoles roles;
        EscrowWindows windows;
        DepositCaps depositCaps;
    }

    error EscrowMismatch(string field);

    function predictEscrow(address deployer) public pure returns (address) {
        return predictAddress(deployer, ESCROW_SALT_LABEL);
    }

    function _envWindows() internal view returns (EscrowWindows memory windows) {
        windows.withdrawalDelay =
            SafeCast.toUint64(vm.envOr("ESCROW_WITHDRAWAL_DELAY_SECONDS", uint256(DEFAULT_WITHDRAWAL_DELAY)));
        windows.claimWindow = SafeCast.toUint64(vm.envOr("ESCROW_CLAIM_WINDOW_SECONDS", uint256(DEFAULT_CLAIM_WINDOW)));
        windows.signerThawPeriod =
            SafeCast.toUint64(vm.envOr("ESCROW_SIGNER_THAW_SECONDS", uint256(windows.withdrawalDelay)));
    }

    function _envDepositCaps() internal view returns (DepositCaps memory caps) {
        caps.total = SafeCast.toUint128(vm.envUint("ESCROW_DEPOSIT_CAP_TOTAL"));
        caps.perAccount = SafeCast.toUint128(vm.envUint("ESCROW_DEPOSIT_CAP_PER_ACCOUNT"));
    }

    function _deployEscrow(EscrowConfig memory config, address feeReceiver) internal returns (SnapflowEscrow escrow) {
        bytes memory initCode = abi.encodePacked(
            type(SnapflowEscrow).creationCode,
            abi.encode(config.token, config.roles, config.windows, config.depositCaps)
        );
        escrow = SnapflowEscrow(_deployCreate3(ESCROW_SALT_LABEL, initCode));
        _assertEscrow(escrow, config);
        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) _recordDeployment(escrow, config, feeReceiver);
    }

    function _recordDeployment(SnapflowEscrow escrow, EscrowConfig memory config, address feeReceiver) private {
        vm.serializeAddress("roles", "admin", config.roles.admin);
        vm.serializeAddress("roles", "pauser", config.roles.pauser);
        vm.serializeAddress("roles", "guardian", config.roles.guardian);
        vm.serializeAddress("roles", "claimsFreezer", config.roles.claimsFreezer);
        string memory roles = vm.serializeAddress("roles", "compliance", config.roles.compliance);

        vm.serializeUint("windows", "withdrawalDelay", config.windows.withdrawalDelay);
        vm.serializeUint("windows", "claimWindow", config.windows.claimWindow);
        string memory windows = vm.serializeUint("windows", "signerThawPeriod", config.windows.signerThawPeriod);

        vm.serializeUint("depositCaps", "total", config.depositCaps.total);
        string memory depositCaps = vm.serializeUint("depositCaps", "perAccount", config.depositCaps.perAccount);

        vm.serializeAddress("constructorArgs", "token", address(config.token));
        vm.serializeString("constructorArgs", "roles", roles);
        vm.serializeString("constructorArgs", "windows", windows);
        string memory constructorArgs = vm.serializeString("constructorArgs", "depositCaps", depositCaps);

        vm.serializeAddress("escrow", "address", address(escrow));
        vm.serializeAddress("escrow", "deployer", msg.sender);
        vm.serializeAddress("escrow", "feeReceiver", feeReceiver);
        vm.serializeBytes32("escrow", "salt", deploymentSalt(msg.sender, ESCROW_SALT_LABEL));
        vm.serializeUint("escrow", "blockNumber", block.number);
        string memory deployment = vm.serializeString("escrow", "constructorArgs", constructorArgs);

        vm.serializeUint("registry", "chainId", block.chainid);
        vm.serializeAddress("registry", "createX", address(CREATEX));
        string memory registry = vm.serializeString("registry", "escrow", deployment);
        vm.writeJson(registry, string.concat(REGISTRY_DIRECTORY, vm.toString(block.chainid), REGISTRY_EXTENSION));
    }

    function _assertEscrow(SnapflowEscrow escrow, EscrowConfig memory config) private view {
        _require(address(escrow.token()) == address(config.token), "token");
        _require(escrow.withdrawalDelay() == config.windows.withdrawalDelay, "withdrawalDelay");
        _require(escrow.claimWindow() == config.windows.claimWindow, "claimWindow");
        _require(escrow.signerThawPeriod() == config.windows.signerThawPeriod, "signerThawPeriod");
        _require(escrow.depositCaps().total == config.depositCaps.total, "depositCaps.total");
        _require(escrow.depositCaps().perAccount == config.depositCaps.perAccount, "depositCaps.perAccount");
        _require(escrow.defaultAdmin() == config.roles.admin, "defaultAdmin");
        _require(escrow.defaultAdminDelay() == EscrowLimits.ADMIN_TRANSFER_DELAY, "defaultAdminDelay");
        _require(escrow.hasRole(escrow.PAUSER_ROLE(), config.roles.pauser), "PAUSER_ROLE");
        _require(escrow.hasRole(escrow.PAUSER_ROLE(), config.roles.guardian), "guardian PAUSER_ROLE");
        _require(escrow.hasRole(escrow.CLAIMS_FREEZE_ROLE(), config.roles.claimsFreezer), "CLAIMS_FREEZE_ROLE");
        _require(escrow.hasRole(escrow.COMPLIANCE_ROLE(), config.roles.compliance), "COMPLIANCE_ROLE");
    }

    function _require(bool holds, string memory field) internal pure {
        if (!holds) revert EscrowMismatch(field);
    }
}
