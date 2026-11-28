/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SafeCall } from '@snapflow/contracts';
import { type Address, getAddress, isAddressEqual } from 'viem';
import type { WalletCallContext } from './wallet-call-policy.util';
import {
	type DecodedWalletCall,
	decodedWalletCalls,
	type EscrowCall,
	type SafeOwnerCall,
	WalletCallTarget,
} from './wallet-decoded-calls.util';

type CounterpartyContext = Pick<
	WalletCallContext,
	'safe' | 'usdc' | 'escrow' | 'relayer' | 'delegatedSigner'
>;

function escrowCounterparties(call: EscrowCall): Address[] {
	switch (call.functionName) {
		case 'depositFor':
		case 'setAutoTopUp':
		case 'authorizeSigner':
			return [call.args[0]];
		default:
			return [];
	}
}

function ownerCounterparties(call: SafeOwnerCall): Address[] {
	switch (call.functionName) {
		case 'addOwnerWithThreshold':
			return [call.args[0]];
		case 'swapOwner':
			return [call.args[2]];
		default:
			return [];
	}
}

function counterparties(decoded: DecodedWalletCall | null): Address[] {
	switch (decoded?.target) {
		case WalletCallTarget.USDC:
			return decoded.call.functionName === 'transfer'
				? [decoded.call.args[0]]
				: [];
		case WalletCallTarget.ESCROW:
			return escrowCounterparties(decoded.call);
		case WalletCallTarget.SAFE:
			return ownerCounterparties(decoded.call);
		default:
			return [];
	}
}

export function walletCallCounterparties(
	call: SafeCall,
	context: CounterpartyContext,
	snapflowOwned: readonly Address[]
): Address[] {
	const own = [
		context.safe,
		context.escrow,
		context.relayer,
		...(context.delegatedSigner ? [context.delegatedSigner] : []),
		...snapflowOwned,
	];
	const found = decodedWalletCalls(call, context)
		.flatMap(counterparties)
		.filter((address) => !own.some((known) => isAddressEqual(known, address)));
	return [...new Set(found.map((address) => getAddress(address)))];
}
