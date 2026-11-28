/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import ReceiptText from '@lucide/svelte/icons/receipt-text';
import type { RefundDue } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	adminRefundsDueQueryOptions,
	recordRefundMutationOptions,
} from '#lib/api/admin/refunds.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { copyId, matchesSearch } from '#lib/features/admin/lib/admin-list.ts';
import {
	REFUND_FILTER_KEYS,
	REFUND_SORT_OPTIONS,
	refundsSearchSchema,
} from '#lib/features/admin/lib/refunds-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class RefundsList {
	readonly #params = new SearchParams(refundsSearchSchema);

	readonly controls = new AdminListControls(this.#params, {
		sortOptions: REFUND_SORT_OPTIONS,
		filterKeys: REFUND_FILTER_KEYS,
	});
	readonly refundsQuery = createQuery(() => adminRefundsDueQueryOptions());
	readonly record = createMutation(() => recordRefundMutationOptions());

	recording = $state.raw<RefundDue | null>(null);

	readonly #allRefunds: readonly RefundDue[] = $derived.by(
		() => this.refundsQuery.data ?? []
	);
	readonly #refundsById = $derived.by(
		() =>
			new Map(
				this.#allRefunds.map((refund) => [refund.paymentChannelId, refund])
			)
	);
	readonly refunds: readonly RefundDue[] = $derived.by(() =>
		this.#allRefunds.filter((refund) =>
			matchesSearch(this.controls.search.value, [
				refund.paymentChannelId,
				refund.customerOrganizationId,
				refund.customerOrganizationName,
				refund.customerAddress,
			])
		)
	);

	refundActions = (refund: RefundDue): ResourceRowAction[] => [
		{
			icon: ReceiptText,
			label: 'Record refund',
			onSelect: () => {
				this.recording = refund;
			},
		},
		{
			icon: Copy,
			label: 'Copy customer address',
			onSelect: () => copyId(refund.customerAddress),
		},
	];

	refundRowActions = (paymentChannelId: string): ResourceRowAction[] => {
		const refund = this.#refundsById.get(paymentChannelId);
		return refund ? this.refundActions(refund) : [];
	};

	close = (): void => {
		this.recording = null;
	};

	confirmRecord = (
		refund: RefundDue,
		transactionHash: string
	): Promise<unknown> =>
		this.record.mutateAsync(
			{
				path: { paymentChannelId: refund.paymentChannelId },
				body: { transactionHash, dueMicroUsd: refund.dueMicroUsd },
			},
			{ onSuccess: this.close }
		);
}
