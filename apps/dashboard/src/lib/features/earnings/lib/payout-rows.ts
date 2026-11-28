/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { HostPayout, HostPayoutClaim } from '@snapflow/api-client';

export type PayoutRow =
	| { kind: 'payout'; id: string; payout: HostPayout; expanded: boolean }
	| { kind: 'claim'; id: string; claim: HostPayoutClaim; payout: HostPayout };

const CLAIM_ROW_SEPARATOR = ':claim:';

export function payoutRows(
	payouts: readonly HostPayout[],
	expanded: ReadonlySet<string>
): PayoutRow[] {
	return payouts.flatMap((payout): PayoutRow[] => {
		const open = expanded.has(payout.id);
		const head: PayoutRow = {
			kind: 'payout',
			id: payout.id,
			payout,
			expanded: open,
		};
		if (!open) return [head];
		return [
			head,
			...payout.claims.map(
				(claim, index): PayoutRow => ({
					kind: 'claim',
					id: `${payout.id}${CLAIM_ROW_SEPARATOR}${index}`,
					claim,
					payout,
				})
			),
		];
	});
}

export function payoutRowTransaction(row: PayoutRow): string {
	return row.kind === 'payout'
		? row.payout.transactionHash
		: row.claim.transactionHash;
}
