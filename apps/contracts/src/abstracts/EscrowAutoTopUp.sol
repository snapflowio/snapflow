// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import { EscrowLimits } from "../libraries/EscrowLimits.sol";
import { AutoTopUp } from "../types/EscrowTypes.sol";
import { EscrowAccounts } from "./EscrowAccounts.sol";

abstract contract EscrowAutoTopUp is EscrowAccounts {
    using SafeERC20 for IERC20;

    mapping(address customer => AutoTopUp) private _autoTopUps;

    function setAutoTopUp(
        address relayer,
        uint128 amount,
        uint128 threshold,
        uint128 maxRelayFee,
        uint32 minInterval
    )
        external
        whenNotPaused
    {
        if (relayer == address(0) || relayer == msg.sender) revert InvalidAutoTopUpRelayer(relayer);
        _requireNotBlocked(msg.sender);
        _requireNotBlocked(relayer);
        if (amount == 0 || threshold == 0) revert ZeroAmount();
        if (maxRelayFee > EscrowLimits.MAX_RELAY_FEE) revert RelayFeeTooHigh(maxRelayFee, EscrowLimits.MAX_RELAY_FEE);
        if (maxRelayFee >= amount) revert RelayFeeTooHigh(maxRelayFee, amount);
        if (minInterval < EscrowLimits.MIN_AUTO_TOP_UP_INTERVAL) {
            revert AutoTopUpIntervalTooShort(minInterval, EscrowLimits.MIN_AUTO_TOP_UP_INTERVAL);
        }
        AutoTopUp storage config = _autoTopUps[msg.sender];
        config.relayer = relayer;
        config.amount = amount;
        config.threshold = threshold;
        config.maxRelayFee = maxRelayFee;
        config.minInterval = minInterval;
        emit AutoTopUpSet(msg.sender, relayer, amount, threshold, maxRelayFee, minInterval);
    }

    function disableAutoTopUp() external {
        if (_autoTopUps[msg.sender].relayer == address(0)) revert AutoTopUpNotEnabled(msg.sender);
        delete _autoTopUps[msg.sender];
        emit AutoTopUpDisabled(msg.sender);
    }

    // forge-lint: disable-next-item(arbitrary-send-erc20)
    function autoTopUp(address customer, uint256 relayFee) external nonReentrant {
        AutoTopUp storage config = _autoTopUps[customer];
        address relayer = config.relayer;
        if (relayer == address(0)) revert AutoTopUpNotEnabled(customer);
        if (msg.sender != relayer) revert NotAuthorized(msg.sender);
        if (relayFee > config.maxRelayFee) revert RelayFeeTooHigh(relayFee, config.maxRelayFee);
        uint256 available = availableOf(customer);
        if (available >= config.threshold) revert AutoTopUpNotNeeded(customer, available);
        uint64 now64 = _now64();
        uint64 nextAt = config.lastTopUpAt + config.minInterval;
        if (now64 < nextAt) revert AutoTopUpTooSoon(customer, nextAt);

        uint256 amount = config.amount;
        uint256 credited = amount - relayFee;
        config.lastTopUpAt = now64;
        _creditDeposit(customer, customer, credited);
        _recordTokensIn(credited);
        emit AutoTopUpExecuted(customer, msg.sender, amount, relayFee);
        // slither-disable-next-line arbitrary-send-erc20
        token.safeTransferFrom(customer, address(this), amount);
        if (relayFee != 0) {
            emit RelayFeePaid(msg.sender, customer, relayFee);
            _forwardTokens(msg.sender, relayFee);
        }
    }

    function autoTopUpOf(address customer) external view returns (AutoTopUp memory) {
        return _autoTopUps[customer];
    }
}
