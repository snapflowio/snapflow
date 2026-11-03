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
import type { ResourceRefreshInterval } from '#lib/components/resource/resource-refresh.ts';
import { matchesAuditSearch } from '#lib/features/audit/lib/audit-event.ts';
import {
	AUDIT_EVENT_PARAM,
	auditSearchSchema,
} from '#lib/features/audit/lib/audit-list.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class AuditList {
	readonly #params = new SearchParams(auditSearchSchema);

	readonly search = this.#params.text('search');
	refreshInterval = $state<ResourceRefreshInterval>(false);
	readonly from: string = $derived.by(() => this.#params.current.from);
	readonly to: string = $derived.by(() => this.#params.current.to);

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
	readonly events: readonly AuditLog[] = $derived.by(() => {
		const query = this.search.value.trim().toLowerCase();
		return this.#loadedEvents.filter((event) =>
			matchesAuditSearch(event, query)
		);
	});
	readonly panel = new OpenRowParam(
		() => this.events,
		(event) => event.id,
		{ param: AUDIT_EVENT_PARAM }
	);
	readonly filtered: boolean = $derived.by(() =>
		Boolean(this.search.value.trim() || this.from || this.to)
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

	refetch = (): void => {
		void this.auditQuery.refetch();
	};

	loadMore = (): void => {
		void this.auditQuery.fetchNextPage();
	};
}
