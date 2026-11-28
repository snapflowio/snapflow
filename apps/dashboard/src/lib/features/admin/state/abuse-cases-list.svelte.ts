/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import CircleCheck from '@lucide/svelte/icons/circle-check';
import Copy from '@lucide/svelte/icons/copy';
import type { AbuseCase } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	adminAllAbuseCasesQueryOptions,
	resolveAbuseCaseMutationOptions,
} from '#lib/api/admin/abuse-cases.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import {
	ABUSE_CASE_FILTER_KEYS,
	ABUSE_CASE_SORT_OPTIONS,
	ABUSE_CASE_STATUS_OPTIONS,
	abuseCasesSearchSchema,
	findingsSummary,
	isOpenCase,
} from '#lib/features/admin/lib/abuse-cases-list.ts';
import { adminFilter } from '#lib/features/admin/lib/admin-filters.ts';
import {
	copyId,
	matchesFilter,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class AbuseCasesList {
	readonly #params = new SearchParams(abuseCasesSearchSchema);

	readonly controls = new AdminListControls(this.#params, {
		sortOptions: ABUSE_CASE_SORT_OPTIONS,
		filterKeys: ABUSE_CASE_FILTER_KEYS,
		filterFields: () => [
			adminFilter({
				id: 'status',
				label: 'Status',
				options: ABUSE_CASE_STATUS_OPTIONS,
				values: this.#params.current.status,
				onChange: (status) => void this.#params.update({ status }),
			}),
		],
	});
	readonly casesQuery = createQuery(() => adminAllAbuseCasesQueryOptions());
	readonly resolveMutation = createMutation(() =>
		resolveAbuseCaseMutationOptions()
	);

	resolving = $state.raw<AbuseCase | null>(null);

	readonly #allCases: readonly AbuseCase[] = $derived.by(
		() => this.casesQuery.data ?? []
	);
	readonly #casesById = $derived.by(
		() => new Map(this.#allCases.map((abuseCase) => [abuseCase.id, abuseCase]))
	);
	readonly cases: readonly AbuseCase[] = $derived.by(() =>
		this.#allCases.filter(
			(abuseCase) =>
				matchesSearch(this.controls.search.value, [
					abuseCase.id,
					abuseCase.sandboxId,
					abuseCase.organizationId,
					abuseCase.machineId ?? '',
					findingsSummary(abuseCase),
				]) && matchesFilter(this.#params.current.status, abuseCase.status)
		)
	);

	readonly panel = new OpenRowParam(
		() => this.cases,
		(abuseCase) => abuseCase.id
	);

	caseActions = (abuseCase: AbuseCase): ResourceRowAction[] => [
		{
			icon: CircleCheck,
			label: 'Resolve',
			onSelect: () => {
				this.resolving = abuseCase;
			},
			visible: isOpenCase(abuseCase),
		},
		{
			icon: Copy,
			label: 'Copy sandbox ID',
			onSelect: () => copyId(abuseCase.sandboxId),
		},
		{
			icon: Copy,
			label: 'Copy organization ID',
			onSelect: () => copyId(abuseCase.organizationId),
		},
	];

	caseRowActions = (caseId: string): ResourceRowAction[] => {
		const abuseCase = this.#casesById.get(caseId);
		return abuseCase ? this.caseActions(abuseCase) : [];
	};

	cancelResolve = (): void => {
		this.resolving = null;
	};

	confirmResolve = (abuseCase: AbuseCase): void => {
		this.resolveMutation.mutate(abuseCase, {
			onSuccess: () => {
				this.resolving = null;
			},
		});
	};
}
