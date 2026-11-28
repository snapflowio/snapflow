/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SafeCall } from '@snapflow/contracts';
import {
	type DecodedWalletCall,
	decodedWalletCalls,
	WalletCallTarget,
	type WalletCallTargets,
} from './wallet-decoded-calls.util';

function isExitCall(decoded: DecodedWalletCall | null): boolean {
	switch (decoded?.target) {
		case WalletCallTarget.USDC:
			return decoded.call.functionName === 'transfer';
		case WalletCallTarget.ESCROW:
			return (
				decoded.call.functionName === 'requestWithdrawal' ||
				decoded.call.functionName === 'completeWithdrawal'
			);
		case WalletCallTarget.SAFE:
			return decoded.call.functionName === 'addOwnerWithThreshold';
		default:
			return false;
	}
}

export function isWalletExitCall(
	call: SafeCall,
	targets: WalletCallTargets
): boolean {
	return decodedWalletCalls(call, targets).every(isExitCall);
}
