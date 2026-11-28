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
	snapflowEscrowAbi,
} from '@snapflow/contracts';
import { type Address, erc20Abi, type Hex, isAddressEqual } from 'viem';
import { decodedCall, type WalletCallContext } from './wallet-call-policy.util';

type OutflowContext = Pick<WalletCallContext, 'usdc' | 'escrow'>;

function plainOutflow(to: Address, data: Hex, context: OutflowContext): bigint {
	if (isAddressEqual(to, context.usdc)) {
		const call = decodedCall(erc20Abi, data);
		return call?.functionName === 'transfer' ? call.args[1] : 0n;
	}
	if (isAddressEqual(to, context.escrow)) {
		const call = decodedCall(snapflowEscrowAbi, data);
		switch (call?.functionName) {
			case 'deposit':
				return call.args[0];
			case 'depositFor':
				return call.args[1];
			default:
				return 0n;
		}
	}
	return 0n;
}

export function walletUsdcOutflow(
	call: SafeCall,
	context: OutflowContext
): bigint {
	if (call.operation !== SafeOperation.DELEGATE_CALL) {
		return plainOutflow(call.to, call.data, context);
	}
	const batch = decodedCall(multiSendCallOnlyAbi, call.data);
	if (!batch) return 0n;
	return decodeMultiSendTransactions(batch.args[0]).reduce(
		(total, inner) => total + plainOutflow(inner.to, inner.data, context),
		0n
	);
}
