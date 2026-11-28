/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AuditLog } from '@snapflow/api-client';
import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { auditLogsInfiniteQueryOptions } from '#lib/api/audit.ts';
import type { ResourceQuickFilterField } from '#lib/components/resource/filter/resource-filter-panel.svelte';
import type { ResourceFilterTag } from '#lib/components/resource/resource-options.ts';
import type { ResourceRefreshInterval } from '#lib/components/resource/resource-refresh.ts';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import {
	AUDIT_CATEGORIES,
	AUDIT_CATEGORY_LABEL,
	AUDIT_VIA_LABEL,
	AUDIT_VIAS,
	type AuditCategory,
	type AuditVia,
	auditActorIds,
	auditActorLabel,
	auditCategory,
	auditVia,
	matchesAuditSearch,
} from '#lib/features/audit/lib/audit-event.ts';
import {
	AUDIT_EVENT_PARAM,
	auditSearchSchema,
} from '#lib/features/audit/lib/audit-list.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { formatDate } from '#lib/utils/format.ts';

const FILTER_FIELD = {
	ACTOR: 'Actor',
	CATEGORY: 'Action',
	VIA: 'Via',
	DATE: 'Date',
} as const;
const DATE_RANGE_SEPARATOR = ' – ';
const OPEN_RANGE = '…';

const CATEGORY_OPTIONS: readonly ChipOption<AuditCategory>[] =
	AUDIT_CATEGORIES.map((category) => ({
		value: category,
		label: AUDIT_CATEGORY_LABEL[category],
	}));

const VIA_OPTIONS: readonly ChipOption<AuditVia>[] = AUDIT_VIAS.map((via) => ({
	value: via,
	label: AUDIT_VIA_LABEL[via],
}));

export class AuditList {
	readonly #params = new SearchParams(auditSearchSchema);

	readonly search = this.#params.text('search');
	refreshInterval = $state<ResourceRefreshInterval>(false);
	readonly from: string = $derived.by(() => this.#params.current.from);
	readonly to: string = $derived.by(() => this.#params.current.to);
	readonly actors: readonly string[] = $derived.by(
		() => this.#params.current.actor
	);
	readonly categories: readonly AuditCategory[] = $derived.by(
		() => this.#params.current.category
	);
	readonly vias: readonly AuditVia[] = $derived.by(
		() => this.#params.current.via
	);

	readonly auditQuery = createInfiniteQuery(() => ({
		...auditLogsInfiniteQueryOptions({ from: this.from, to: this.to }),
		initialPageParam: {},
		getNextPageParam: (lastPage: { nextCursor: string | null }) =>
			lastPage.nextCursor ?? undefined,
		placeholderData: keepPreviousData,
		refetchInterval: this.refreshInterval,
	}));

	readonly #loadedEvents: AuditLog[] = $derived.by(
		() =>
			this.auditQuery.data?.pages.flatMap((auditPage) => auditPage.items) ?? []
	);
	readonly #actorOptions: readonly ChipOption[] = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const event of this.#loadedEvents) {
			if (!seen.has(event.actorId)) {
				seen.set(event.actorId, auditActorLabel(event));
			}
		}
		for (const actor of this.actors) {
			if (!seen.has(actor)) seen.set(actor, actor);
		}
		return [...seen].map(([value, label]) => ({ value, label }));
	});
	readonly events: readonly AuditLog[] = $derived.by(() => {
		const query = this.search.value.trim().toLowerCase();
		return this.#loadedEvents.filter(
			(event) =>
				matchesAuditSearch(event, query) &&
				(this.actors.length === 0 ||
					auditActorIds(event).some((id) => this.actors.includes(id))) &&
				(this.categories.length === 0 ||
					this.categories.includes(auditCategory(event))) &&
				(this.vias.length === 0 || this.vias.includes(auditVia(event)))
		);
	});
	readonly panel = new OpenRowParam(
		() => this.events,
		(event) => event.id,
		{ param: AUDIT_EVENT_PARAM }
	);
	readonly #hasFieldFilters: boolean = $derived.by(
		() =>
			this.actors.length + this.categories.length + this.vias.length > 0 ||
			Boolean(this.from || this.to)
	);
	readonly filtered: boolean = $derived.by(() =>
		Boolean(this.search.value.trim() || this.#hasFieldFilters)
	);

	readonly quickFields: readonly ResourceQuickFilterField[] = $derived.by(
		() => [
			{
				id: 'actor',
				label: FILTER_FIELD.ACTOR,
				options: this.#actorOptions,
				values: this.actors,
				onChange: (actor: string[]) => void this.#params.update({ actor }),
			},
			{
				id: 'category',
				label: FILTER_FIELD.CATEGORY,
				options: CATEGORY_OPTIONS,
				values: this.categories,
				onChange: (category: string[]) =>
					void this.#params.update({
						category: category.filter(isCategory),
					}),
			},
			{
				id: 'via',
				label: FILTER_FIELD.VIA,
				options: VIA_OPTIONS,
				values: this.vias,
				onChange: (via: string[]) =>
					void this.#params.update({ via: via.filter(isVia) }),
			},
		]
	);

	readonly filterTags: readonly ResourceFilterTag[] = $derived.by(() => {
		const tags: ResourceFilterTag[] = [];
		for (const actor of this.actors) {
			tags.push({
				field: FILTER_FIELD.ACTOR,
				value:
					this.#actorOptions.find((option) => option.value === actor)?.label ??
					actor,
				onRemove: () =>
					void this.#params.update({
						actor: this.actors.filter((value) => value !== actor),
					}),
			});
		}
		for (const category of this.categories) {
			tags.push({
				field: FILTER_FIELD.CATEGORY,
				value: AUDIT_CATEGORY_LABEL[category],
				onRemove: () =>
					void this.#params.update({
						category: this.categories.filter((value) => value !== category),
					}),
			});
		}
		for (const via of this.vias) {
			tags.push({
				field: FILTER_FIELD.VIA,
				value: AUDIT_VIA_LABEL[via],
				onRemove: () =>
					void this.#params.update({
						via: this.vias.filter((value) => value !== via),
					}),
			});
		}
		if (this.from || this.to) {
			tags.push({
				field: FILTER_FIELD.DATE,
				value: [
					this.from ? formatDate(this.from) : OPEN_RANGE,
					this.to ? formatDate(this.to) : OPEN_RANGE,
				].join(DATE_RANGE_SEPARATOR),
				onRemove: this.clearRange,
			});
		}
		return tags;
	});

	readonly fieldFiltersActive: boolean = $derived.by(
		() => this.actors.length + this.categories.length + this.vias.length > 0
	);

	setRefreshInterval = (interval: ResourceRefreshInterval): void => {
		this.refreshInterval = interval;
	};

	changeRange = (nextFrom: string, nextTo: string): void => {
		void this.#params.update({ from: nextFrom, to: nextTo });
	};

	clearRange = (): void => {
		this.changeRange('', '');
	};

	clearFilters = (): void => {
		void this.#params.update({
			actor: [],
			category: [],
			via: [],
			from: '',
			to: '',
		});
	};

	refetch = (): void => {
		void this.auditQuery.refetch();
	};

	loadMore = (): void => {
		void this.auditQuery.fetchNextPage();
	};
}

function isCategory(value: string): value is AuditCategory {
	return AUDIT_CATEGORIES.some((category) => category === value);
}

function isVia(value: string): value is AuditVia {
	return AUDIT_VIAS.some((via) => via === value);
}
