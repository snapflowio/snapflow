/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EscrowAccount } from '@snapflow/api-client';
import { formatUsd } from '#lib/utils/usd.ts';

type HeldAccount = Pick<
	EscrowAccount,
	'freeMicroUsd' | 'pendingMicroUsd' | 'frozenMicroUsd'
>;

type BreakdownAccount = HeldAccount &
	Pick<EscrowAccount, 'outstandingMicroUsd' | 'availableMicroUsd'>;

export function escrowDepositedMicroUsd(account: HeldAccount): string {
	return (
		BigInt(account.freeMicroUsd) +
		BigInt(account.pendingMicroUsd) +
		BigInt(account.frozenMicroUsd)
	).toString();
}

export function availableBreakdown(account: BreakdownAccount): string {
	return [
		`Deposited ${formatUsd(escrowDepositedMicroUsd(account))}`,
		`owed to hosts ${formatUsd(account.outstandingMicroUsd)}`,
		`withdrawing ${formatUsd(account.pendingMicroUsd)}`,
		`frozen ${formatUsd(account.frozenMicroUsd)}`,
	].join(' − ');
}

export function hasMicroUsd(value: string | null | undefined): boolean {
	return value !== null && value !== undefined && BigInt(value) > 0n;
}
