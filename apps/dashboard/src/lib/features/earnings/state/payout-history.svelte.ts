/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import Copy from '@lucide/svelte/icons/copy';
import PanelRight from '@lucide/svelte/icons/panel-right';
import type { HostPayout } from '@snapflow/api-client';
import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { SvelteSet } from 'svelte/reactivity';
import { getPublicConfig } from '#lib/api/public-config.ts';
import { hostPayoutsInfiniteQueryOptions } from '#lib/api/settlement/host-payouts.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { copyWithToast } from '#lib/components/ui/clipboard/copy-with-toast.ts';
import {
	cursorPageItems,
	nextCursorPage,
} from '#lib/features/billing/lib/infinite-cursor.ts';
import {
	type PayoutRow,
	payoutRows,
	payoutRowTransaction,
} from '#lib/features/earnings/lib/payout-rows.ts';
import { explorerTransactionUrl } from '#lib/features/wallet/lib/explorer.ts';

const TRANSACTION_HASH_LABEL = 'transaction hash';
const NEW_TAB_TARGET = '_blank';
const NEW_TAB_FEATURES = 'noopener,noreferrer';

function createPayoutsQuery(machineId: () => string | null) {
	return createInfiniteQuery(() => ({
		...hostPayoutsInfiniteQueryOptions({
			machineId: machineId() ?? undefined,
		}),
		initialPageParam: {},
		getNextPageParam: nextCursorPage,
		placeholderData: keepPreviousData,
	}));
}

export class PayoutHistory {
	readonly #chainId = getPublicConfig().settlement.chainId;
	readonly expanded = new SvelteSet<string>();
	readonly query: ReturnType<typeof createPayoutsQuery>;

	readonly payouts = $derived.by(() => cursorPageItems(this.query.data));
	readonly rows: PayoutRow[] = $derived(
		payoutRows(this.payouts, this.expanded)
	);
	readonly #rowsById = $derived(new Map(this.rows.map((row) => [row.id, row])));
	openId = $state<string | null>(null);
	readonly openPayout: HostPayout | null = $derived(
		this.payouts.find((payout) => payout.id === this.openId) ?? null
	);

	constructor(machineId: () => string | null) {
		this.query = createPayoutsQuery(machineId);
	}

	open = (payoutId: string): void => {
		this.openId = payoutId;
	};

	close = (): void => {
		this.openId = null;
	};

	toggle = (rowId: string): void => {
		const row = this.#rowsById.get(rowId);
		if (row?.kind !== 'payout' || row.payout.claims.length === 0) return;
		if (this.expanded.has(row.id)) this.expanded.delete(row.id);
		else this.expanded.add(row.id);
	};

	explorerUrl = (hash: string): string | null =>
		explorerTransactionUrl(this.#chainId, hash);

	rowActions = (row: PayoutRow): ResourceRowAction[] => {
		const hash = payoutRowTransaction(row);
		const url = this.explorerUrl(hash);
		return [
			{
				icon: PanelRight,
				label: 'View details',
				onSelect: () => this.open(row.payout.id),
			},
			{
				icon: ArrowUpRight,
				label: 'View transaction',
				onSelect: () => {
					if (url) window.open(url, NEW_TAB_TARGET, NEW_TAB_FEATURES);
				},
				visible: url !== null,
			},
			{
				icon: Copy,
				label: 'Copy transaction hash',
				onSelect: () => void copyWithToast(hash, TRANSACTION_HASH_LABEL),
			},
		];
	};

	actionsFor = (rowId: string | null): ResourceRowAction[] => {
		const row = rowId ? this.#rowsById.get(rowId) : undefined;
		return row ? this.rowActions(row) : [];
	};
}
