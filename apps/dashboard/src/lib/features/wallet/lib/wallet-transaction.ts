/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	PublicSettlementConfig,
	WalletTransaction,
} from '@snapflow/api-client';
import { formatUsd } from '#lib/utils/usd.ts';
import {
	walletCallActions,
	walletCallSummary,
	walletTransactionCall,
} from './wallet-call.ts';

const RECOVERY_OWNER_LABEL = 'Added a recovery owner';
const UNKNOWN_TRANSACTION_LABEL = 'Wallet transaction';

export function walletTransactionFee(transaction: WalletTransaction): string {
	const paid = transaction.feePaidMicroUsd;
	if (paid === null) {
		return `${formatUsd(transaction.feeMicroUsd)} fee quoted`;
	}
	return BigInt(paid) > 0n ? `${formatUsd(paid)} fee paid` : 'No fee charged';
}

export function walletTransactionLabel(
	transaction: WalletTransaction,
	settlement: PublicSettlementConfig
): string {
	if (transaction.recoveryOwnerKind) return RECOVERY_OWNER_LABEL;
	const call = walletTransactionCall(transaction);
	const summary = call
		? walletCallSummary(walletCallActions(call, settlement))
		: null;
	return summary ?? UNKNOWN_TRANSACTION_LABEL;
}
