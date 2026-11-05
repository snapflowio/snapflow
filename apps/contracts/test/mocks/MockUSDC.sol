// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { ERC20 } from "@openzeppelin-contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin-contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice Six-decimal permit token standing in for USDC in local tests.
contract MockUSDC is ERC20, ERC20Permit {
    uint8 private constant USDC_DECIMALS = 6;

    constructor() ERC20("USD Coin", "USDC") ERC20Permit("USD Coin") { }

    function decimals() public pure override returns (uint8) {
        return USDC_DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
