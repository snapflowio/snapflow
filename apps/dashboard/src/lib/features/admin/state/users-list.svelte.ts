/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AdminUser } from '@snapflow/api-client';
import {
	createInfiniteQuery,
	createQuery,
	keepPreviousData,
} from '@tanstack/svelte-query';
import {
	adminUserQueryOptions,
	adminUsersInfiniteQueryOptions,
} from '#lib/api/admin/users.ts';
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
	adminServerSort,
} from '#lib/features/admin/lib/admin-list.ts';
import {
	USER_FILTER_KEYS,
	USER_PANEL_PARAM,
	USER_ROLE_LABELS,
	USER_SORT_FIELDS,
	USER_SORT_OPTIONS,
	USER_STATUS_LABELS,
	usersSearchSchema,
} from '#lib/features/admin/lib/users-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import { AdminUserActions } from '#lib/features/admin/state/admin-user-actions.svelte.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class UsersList {
	readonly #params = new SearchParams(usersSearchSchema);

	readonly controls = new AdminListControls(this.#params, {
		sortOptions: USER_SORT_OPTIONS,
		filterKeys: USER_FILTER_KEYS,
		searchWait: ADMIN_SEARCH_DEBOUNCE_MILLISECONDS,
		filterFields: () => [
			adminFilter({
				id: 'role',
				label: 'Role',
				options: adminFilterOptions(USER_ROLE_LABELS),
				values: this.#params.current.role,
				onChange: (role) => void this.#params.update({ role }),
			}),
			adminFilter({
				id: 'status',
				label: 'Status',
				options: adminFilterOptions(USER_STATUS_LABELS),
				values: this.#params.current.status,
				onChange: (status) => void this.#params.update({ status }),
			}),
		],
	});
	readonly usersQuery = createInfiniteQuery(() => ({
		...adminUsersInfiniteQueryOptions({
			limit: ADMIN_PAGE_SIZE,
			query: this.#params.current.q.trim() || undefined,
			roles: this.#params.current.role,
			statuses: this.#params.current.status,
			...adminServerSort(
				USER_SORT_FIELDS,
				this.#params.current.sort,
				this.#params.current.dir
			),
		}),
		...adminCursorPages,
		placeholderData: keepPreviousData,
	}));
	readonly actions = new AdminUserActions(() => this.panel.close());

	readonly users: readonly AdminUser[] = $derived.by(() =>
		adminPageItems(this.usersQuery.data)
	);
	readonly #usersById = $derived.by(
		() => new Map(this.users.map((user) => [user.id, user]))
	);
	readonly panel = new OpenRowParam(
		() => this.users,
		(user) => user.id,
		{ param: USER_PANEL_PARAM }
	);
	readonly userQuery = createQuery(() => ({
		...adminUserQueryOptions(this.panel.openId ?? ''),
		enabled: this.panel.openId !== null && this.panel.row === null,
	}));
	readonly openUser: AdminUser | null = $derived.by(() => {
		if (this.panel.openId === null) return null;
		return this.panel.row ?? this.userQuery.data ?? null;
	});

	userRowActions = (userId: string): ResourceRowAction[] => {
		const user = this.#usersById.get(userId);
		return user ? this.actions.rowActions(user) : [];
	};
}
