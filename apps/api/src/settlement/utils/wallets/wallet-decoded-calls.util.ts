/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	decodeMultiSendTransactions,
	multiSendCallOnlyAbi,
	type SafeCall,
	SafeOperation,
	safeL2Abi,
	snapflowEscrowAbi,
} from '@snapflow/contracts';
import {
	type Address,
	type DecodeFunctionDataReturnType,
	erc20Abi,
	type Hex,
	isAddressEqual,
} from 'viem';
import { decodedCall, type WalletCallContext } from './wallet-call-policy.util';

export const WalletCallTarget = {
	USDC: 'usdc',
	ESCROW: 'escrow',
	SAFE: 'safe',
} as const;

export type EscrowCall = DecodeFunctionDataReturnType<typeof snapflowEscrowAbi>;
export type SafeOwnerCall = DecodeFunctionDataReturnType<typeof safeL2Abi>;

export type DecodedWalletCall =
	| {
			target: typeof WalletCallTarget.USDC;
			call: DecodeFunctionDataReturnType<typeof erc20Abi>;
	  }
	| { target: typeof WalletCallTarget.ESCROW; call: EscrowCall }
	| { target: typeof WalletCallTarget.SAFE; call: SafeOwnerCall };

export type WalletCallTargets = Pick<
	WalletCallContext,
	'safe' | 'usdc' | 'escrow'
>;

function decodedPlainCall(
	to: Address,
	data: Hex,
	targets: WalletCallTargets
): DecodedWalletCall | null {
	if (isAddressEqual(to, targets.usdc)) {
		const call = decodedCall(erc20Abi, data);
		return call && { target: WalletCallTarget.USDC, call };
	}
	if (isAddressEqual(to, targets.escrow)) {
		const call = decodedCall(snapflowEscrowAbi, data);
		return call && { target: WalletCallTarget.ESCROW, call };
	}
	if (isAddressEqual(to, targets.safe)) {
		const call = decodedCall(safeL2Abi, data);
		return call && { target: WalletCallTarget.SAFE, call };
	}
	return null;
}

export function decodedWalletCalls(
	call: SafeCall,
	targets: WalletCallTargets
): (DecodedWalletCall | null)[] {
	if (call.operation === SafeOperation.CALL) {
		return [decodedPlainCall(call.to, call.data, targets)];
	}
	const batch = decodedCall(multiSendCallOnlyAbi, call.data);
	if (!batch) return [null];
	try {
		return decodeMultiSendTransactions(batch.args[0]).map((inner) =>
			decodedPlainCall(inner.to, inner.data, targets)
		);
	} catch {
		return [null];
	}
}
