/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type EscrowAccount, PendingDepositKind } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { watch } from 'runed';
import {
	escrowPendingChangesQueryOptions,
	escrowPendingUnavailable,
} from '#lib/api/settlement/escrow-pending.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import {
	escrowIndexingDelayed,
	type PendingEscrowRow,
	pendingEscrowRows,
} from '#lib/features/billing/lib/pending-escrow.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import { PendingEscrowChanges } from './pending-escrow-changes.svelte.ts';

function creditedDeposits(
	previous: readonly PendingEscrowRow[],
	next: readonly PendingEscrowRow[]
): bigint[] {
	const remaining = new Set(next.map((row) => row.id));
	const nextHashes = new Set(
		next.map((row) => row.transactionHash?.toLowerCase())
	);
	return previous
		.filter(
			(row) =>
				row.kind === 'deposit' &&
				row.source === PendingDepositKind.Escrow &&
				!remaining.has(row.id) &&
				!nextHashes.has(row.transactionHash.toLowerCase())
		)
		.map((row) => row.amountMicroUsd);
}

export class EscrowPendingRows {
	readonly #account: () => EscrowAccount | undefined;
	readonly #local: PendingEscrowChanges;
	readonly query = createQuery(() => escrowPendingChangesQueryOptions());

	readonly unavailable = $derived(
		this.query.isError && escrowPendingUnavailable(this.query.error)
	);
	readonly #changes = $derived(
		this.query.isSuccess ? this.query.data : undefined
	);
	readonly rows: PendingEscrowRow[] = $derived.by(() => {
		const account = this.#account();
		return account
			? pendingEscrowRows(account, this.#changes, this.#local)
			: [];
	});
	readonly delayed = $derived(escrowIndexingDelayed(this.#changes));

	constructor(account: () => EscrowAccount | undefined) {
		this.#account = account;
		this.#local = new PendingEscrowChanges(account);
		watch(
			() => this.rows,
			(next, previous) => {
				if (!(previous && this.query.isSuccess)) return;
				for (const amount of creditedDeposits(previous, next)) {
					toast.success(`${formatUsd(amount.toString())} added`);
				}
			}
		);
	}
}
