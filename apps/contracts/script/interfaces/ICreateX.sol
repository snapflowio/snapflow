// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

/// @notice The two CreateX functions the deployment scripts use, from
/// https://github.com/pcaversaccio/createx/blob/main/src/ICreateX.sol.
interface ICreateX {
    function deployCreate3(bytes32 salt, bytes memory initCode) external payable returns (address newContract);

    function computeCreate3Address(bytes32 salt) external view returns (address computedAddress);
}
