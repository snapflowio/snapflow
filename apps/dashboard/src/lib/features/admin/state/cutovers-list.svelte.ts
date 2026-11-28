/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import type { ExposureCutoverDto } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	adminCutoversQueryOptions,
	type CutoverActionRequest,
	cutoverActionMutationOptions,
} from '#lib/api/admin/cutovers.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { adminFilter } from '#lib/features/admin/lib/admin-filters.ts';
import {
	copyId,
	matchesFilter,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import {
	CUTOVER_ACTION_COPY,
	CUTOVER_ACTION_ICONS,
	CUTOVER_ACTION_ORDER,
	CUTOVER_FILTER_KEYS,
	CUTOVER_SORT_OPTIONS,
	CUTOVER_STATE_OPTIONS,
	cutoversSearchSchema,
} from '#lib/features/admin/lib/cutovers-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class CutoversList {
	readonly #params = new SearchParams(cutoversSearchSchema);

	readonly controls = new AdminListControls(this.#params, {
		sortOptions: CUTOVER_SORT_OPTIONS,
		filterKeys: CUTOVER_FILTER_KEYS,
		filterFields: () => [
			adminFilter({
				id: 'state',
				label: 'State',
				options: CUTOVER_STATE_OPTIONS,
				values: this.#params.current.state,
				onChange: (state) => void this.#params.update({ state }),
			}),
		],
	});
	readonly cutoversQuery = createQuery(() => adminCutoversQueryOptions());
	readonly runAction = createMutation(() => cutoverActionMutationOptions());

	pending = $state.raw<CutoverActionRequest | null>(null);

	readonly #allCutovers: readonly ExposureCutoverDto[] = $derived.by(
		() => this.cutoversQuery.data ?? []
	);
	readonly #cutoversById = $derived.by(
		() =>
			new Map(this.#allCutovers.map((cutover) => [cutover.backendId, cutover]))
	);
	readonly cutovers: readonly ExposureCutoverDto[] = $derived.by(() =>
		this.#allCutovers.filter(
			(cutover) =>
				matchesSearch(this.controls.search.value, [
					cutover.exposureId,
					cutover.backendId,
					cutover.edgeId,
					cutover.predecessorEdgeId,
				]) && matchesFilter(this.#params.current.state, cutover.state)
		)
	);

	cutoverActions = (cutover: ExposureCutoverDto): ResourceRowAction[] => [
		...CUTOVER_ACTION_ORDER.map((action) => ({
			icon: CUTOVER_ACTION_ICONS[action],
			label: CUTOVER_ACTION_COPY[action].label,
			onSelect: () => {
				this.pending = { action, cutover };
			},
		})),
		{
			icon: Copy,
			label: 'Copy exposure ID',
			onSelect: () => copyId(cutover.exposureId),
		},
	];

	cutoverRowActions = (backendId: string): ResourceRowAction[] => {
		const cutover = this.#cutoversById.get(backendId);
		return cutover ? this.cutoverActions(cutover) : [];
	};

	cancelAction = (): void => {
		this.pending = null;
	};

	confirmAction = (request: CutoverActionRequest): void => {
		this.runAction.mutate(request, {
			onSuccess: () => {
				this.pending = null;
			},
		});
	};
}
