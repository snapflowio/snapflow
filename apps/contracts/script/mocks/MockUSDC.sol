// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { ERC20 } from "@openzeppelin-contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin-contracts/token/ERC20/extensions/ERC20Permit.sol";
import { SignatureChecker } from "@openzeppelin-contracts/utils/cryptography/SignatureChecker.sol";

contract MockUSDC is ERC20, ERC20Permit {
    uint8 private constant USDC_DECIMALS = 6;

    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    mapping(address authorizer => mapping(bytes32 nonce => bool)) public authorizationState;

    error CallerMustBePayee();
    error AuthorizationNotYetValid();
    error AuthorizationExpired();
    error AuthorizationUsed();
    error InvalidAuthorizationSignature();

    constructor() ERC20("USD Coin", "USDC") ERC20Permit("USD Coin") { }

    function decimals() public pure override returns (uint8) {
        return USDC_DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    )
        external
    {
        if (to != msg.sender) revert CallerMustBePayee();
        if (block.timestamp <= validAfter) revert AuthorizationNotYetValid();
        if (block.timestamp >= validBefore) revert AuthorizationExpired();
        if (authorizationState[from][nonce]) revert AuthorizationUsed();
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce))
        );
        if (!SignatureChecker.isValidSignatureNow(from, digest, signature)) revert InvalidAuthorizationSignature();
        authorizationState[from][nonce] = true;
        _transfer(from, to, value);
    }
}
