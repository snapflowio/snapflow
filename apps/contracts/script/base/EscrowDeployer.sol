// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { SnapflowEscrow } from "../../src/SnapflowEscrow.sol";
import { EscrowLimits } from "../../src/libraries/EscrowLimits.sol";
import { DeterministicDeployer } from "./DeterministicDeployer.sol";

/// @notice Deploys SnapflowEscrow at its deterministic address with the broadcaster as admin, grants the operating
/// roles and checks the deployed contract holds exactly what was asked for.
abstract contract EscrowDeployer is DeterministicDeployer {
    /// @dev Salt label of the escrow; a new label is a new address, so change it only for a new escrow version.
    bytes11 internal constant ESCROW_SALT_LABEL = "escrow.v1";

    struct EscrowConfig {
        IERC20 token;
        address feeRecipient;
        address compliance;
        address pauser;
        uint16 feeCapBps;
        uint64 disputeWindow;
    }

    error EscrowMismatch(string field);

    /// @notice The escrow address `deployer` gets on every chain.
    function predictEscrow(address deployer) public pure returns (address) {
        return predictAddress(deployer, ESCROW_SALT_LABEL);
    }

    function _deployEscrow(EscrowConfig memory config) internal returns (SnapflowEscrow escrow) {
        bytes memory initCode = abi.encodePacked(
            type(SnapflowEscrow).creationCode,
            abi.encode(config.token, msg.sender, config.feeRecipient, config.feeCapBps, config.disputeWindow)
        );
        escrow = SnapflowEscrow(_deployCreate3(ESCROW_SALT_LABEL, initCode));
        escrow.grantRole(escrow.COMPLIANCE_ROLE(), config.compliance);
        escrow.grantRole(escrow.PAUSER_ROLE(), config.pauser);
        _assertEscrow(escrow, config);
    }

    function _assertEscrow(SnapflowEscrow escrow, EscrowConfig memory config) private view {
        _require(address(escrow.token()) == address(config.token), "token");
        _require(escrow.feeRecipient() == config.feeRecipient, "feeRecipient");
        _require(escrow.feeCapBps() == config.feeCapBps, "feeCapBps");
        _require(escrow.disputeWindow() == config.disputeWindow, "disputeWindow");
        _require(escrow.defaultAdmin() == msg.sender, "defaultAdmin");
        _require(escrow.defaultAdminDelay() == EscrowLimits.ADMIN_TRANSFER_DELAY, "defaultAdminDelay");
        _require(escrow.hasRole(escrow.COMPLIANCE_ROLE(), config.compliance), "COMPLIANCE_ROLE");
        _require(escrow.hasRole(escrow.PAUSER_ROLE(), config.pauser), "PAUSER_ROLE");
    }

    function _require(bool holds, string memory field) internal pure {
        if (!holds) revert EscrowMismatch(field);
    }
}
