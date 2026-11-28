// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { SignatureChecker } from "@openzeppelin-contracts/utils/cryptography/SignatureChecker.sol";
import { EscrowHashing } from "../libraries/EscrowHashing.sol";
import { EscrowLimits } from "../libraries/EscrowLimits.sol";
import { EscrowCompliance } from "./EscrowCompliance.sol";

abstract contract EscrowPayouts is EscrowCompliance {
    mapping(address host => uint256) private _hostBalances;
    mapping(address host => address) private _payoutAddresses;
    mapping(address host => uint256) private _payoutNonces;
    mapping(address host => uint256) private _hostWithdrawalNonces;

    function setPayoutAddress(address payout) external {
        _setPayoutAddress(msg.sender, payout);
    }

    function setPayoutAddressWithSig(
        address host,
        address payout,
        uint256 deadline,
        bytes calldata signature
    )
        external
    {
        if (deadline <= block.timestamp) revert PayoutSignatureExpired(deadline);
        bytes32 digest = payoutAddressDigest(host, payout, _payoutNonces[host]++, deadline);
        if (!SignatureChecker.isValidSignatureNowCalldata(host, digest, signature)) {
            revert InvalidPayoutSignature(host);
        }
        _setPayoutAddress(host, payout);
    }

    function withdrawHost(address host) external nonReentrant {
        address payout = _payoutAddresses[host];
        if (payout == address(0)) {
            if (msg.sender != host) revert NotAuthorized(msg.sender);
            payout = host;
        }
        _withdrawHost(host, payout, 0);
    }

    function withdrawHostWithSig(
        address host,
        address payout,
        uint256 relayFee,
        uint256 deadline,
        bytes calldata signature
    )
        external
        nonReentrant
    {
        _verifyHostWithdrawal(host, payout, relayFee, deadline, signature);
        _withdrawHost(host, payout, relayFee);
    }

    function hostBalanceOf(address host) external view returns (uint256) {
        return _hostBalances[host];
    }

    function hostWithdrawalNonceOf(address host) external view returns (uint256) {
        return _hostWithdrawalNonces[host];
    }

    function payoutAddressOf(address host) public view returns (address) {
        address payout = _payoutAddresses[host];
        return payout == address(0) ? host : payout;
    }

    function payoutNonceOf(address host) external view returns (uint256) {
        return _payoutNonces[host];
    }

    function payoutAddressDigest(
        address host,
        address payout,
        uint256 nonce,
        uint256 deadline
    )
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(EscrowHashing.payoutAddressStructHash(host, payout, nonce, deadline));
    }

    function hostWithdrawalDigest(
        address host,
        address payout,
        address relayer,
        uint256 relayFee,
        uint256 nonce,
        uint256 deadline
    )
        public
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(EscrowHashing.hostWithdrawalStructHash(host, payout, relayer, relayFee, nonce, deadline));
    }

    function _verifyHostWithdrawal(
        address host,
        address payout,
        uint256 relayFee,
        uint256 deadline,
        bytes calldata signature
    )
        internal
    {
        if (deadline <= block.timestamp) revert HostWithdrawalSignatureExpired(deadline);
        if (relayFee > EscrowLimits.MAX_RELAY_FEE) revert RelayFeeTooHigh(relayFee, EscrowLimits.MAX_RELAY_FEE);
        bytes32 digest =
            hostWithdrawalDigest(host, payout, msg.sender, relayFee, _hostWithdrawalNonces[host]++, deadline);
        if (!SignatureChecker.isValidSignatureNowCalldata(host, digest, signature)) {
            revert InvalidHostWithdrawalSignature(host);
        }
    }

    function _withdrawHost(address host, address payout, uint256 relayFee) internal {
        if (payout == address(0)) revert ZeroAddress();
        _requireNotBlocked(host);
        _requireNotBlocked(payout);
        uint256 amount = _takeHostBalance(host);
        if (amount == 0) revert NothingToWithdraw(host);
        if (relayFee > amount) revert RelayFeeTooHigh(relayFee, amount);
        emit HostWithdrawn(host, payout, amount - relayFee);
        if (relayFee != 0) {
            _requireNotBlocked(msg.sender);
            emit RelayFeePaid(msg.sender, host, relayFee);
            _pushTokens(msg.sender, relayFee);
        }
        if (amount != relayFee) _pushTokens(payout, amount - relayFee);
    }

    function _creditHost(address host, uint256 amount) internal {
        if (amount == 0 || _divertIfBlocked(host, amount)) return;
        _hostBalances[host] += amount;
    }

    function _takeHostBalance(address host) internal returns (uint256 amount) {
        amount = _hostBalances[host];
        _hostBalances[host] = 0;
    }

    function _setPayoutAddress(address host, address payout) private {
        if (payout == address(0)) revert ZeroAddress();
        _requireNotBlocked(host);
        _requireNotBlocked(payout);
        _payoutAddresses[host] = payout;
        emit PayoutAddressSet(host, payout);
    }
}
