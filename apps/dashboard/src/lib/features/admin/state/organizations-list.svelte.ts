/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AdminOrganization } from '@snapflow/api-client';
import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { adminOrganizationsInfiniteQueryOptions } from '#lib/api/admin/organizations.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import {
	adminFilter,
	adminFilterOptions,
} from '#lib/features/admin/lib/admin-filters.ts';
import {
	ADMIN_PAGE_SIZE,
	ADMIN_SEARCH_DEBOUNCE_MILLISECONDS,
	adminCursorPages,
	adminPageItems,
	matchesFilter,
} from '#lib/features/admin/lib/admin-list.ts';
import { adminOrganizationStatusId } from '#lib/features/admin/lib/organization-status.ts';
import {
	ORGANIZATION_FILTER_KEYS,
	ORGANIZATION_SORT_OPTIONS,
	ORGANIZATION_STATUS_LABELS,
	ORGANIZATION_TYPE_LABELS,
	organizationsSearchSchema,
} from '#lib/features/admin/lib/organizations-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import { AdminOrganizationActions } from '#lib/features/admin/state/admin-organization-actions.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export class OrganizationsList {
	readonly #params = new SearchParams(organizationsSearchSchema);

	readonly controls = new AdminListControls(this.#params, {
		sortOptions: ORGANIZATION_SORT_OPTIONS,
		filterKeys: ORGANIZATION_FILTER_KEYS,
		searchWait: ADMIN_SEARCH_DEBOUNCE_MILLISECONDS,
		filterFields: () => [
			adminFilter({
				id: 'type',
				label: 'Type',
				options: adminFilterOptions(ORGANIZATION_TYPE_LABELS),
				values: this.#params.current.type,
				onChange: (type) => void this.#params.update({ type }),
			}),
			adminFilter({
				id: 'status',
				label: 'Status',
				options: adminFilterOptions(ORGANIZATION_STATUS_LABELS),
				values: this.#params.current.status,
				onChange: (status) => void this.#params.update({ status }),
			}),
		],
	});
	readonly organizationsQuery = createInfiniteQuery(() => ({
		...adminOrganizationsInfiniteQueryOptions({
			limit: ADMIN_PAGE_SIZE,
			query: this.#params.current.q.trim() || undefined,
		}),
		...adminCursorPages,
		placeholderData: keepPreviousData,
	}));
	readonly actions = new AdminOrganizationActions();

	readonly #loaded: AdminOrganization[] = $derived.by(() =>
		adminPageItems(this.organizationsQuery.data)
	);
	readonly organizations: readonly AdminOrganization[] = $derived.by(() =>
		this.#loaded.filter(
			(organization) =>
				matchesFilter(
					this.#params.current.type,
					organization.personal ? 'personal' : 'team'
				) &&
				matchesFilter(
					this.#params.current.status,
					adminOrganizationStatusId(organization)
				)
		)
	);
	readonly #organizationsById = $derived.by(
		() =>
			new Map(
				this.#loaded.map((organization) => [organization.id, organization])
			)
	);

	openOrganization = (organizationId: string): void => {
		void goto(
			resolve('/(app)/(dashboard)/admin/organizations/[organizationId]', {
				organizationId,
			})
		);
	};

	organizationRowActions = (organizationId: string): ResourceRowAction[] => {
		const organization = this.#organizationsById.get(organizationId);
		return organization ? this.actions.rowActions(organization) : [];
	};
}
