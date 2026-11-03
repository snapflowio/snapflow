/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AdminUser } from '@snapflow/api-client';
import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { adminUsersInfiniteQueryOptions } from '#lib/api/admin/users.ts';
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
import {
	USER_FILTER_KEYS,
	USER_ROLE_LABELS,
	USER_SORT_OPTIONS,
	USER_STATUS_LABELS,
	usersSearchSchema,
} from '#lib/features/admin/lib/users-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import {
	AdminUserActions,
	isAdminUser,
} from '#lib/features/admin/state/admin-user-actions.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import {
	type SearchParamsPatch,
	withSearchParams,
} from '#lib/routing/search-params.ts';
import { goto } from '$app/navigation';
import { page } from '$app/state';

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
		}),
		...adminCursorPages,
		placeholderData: keepPreviousData,
	}));
	readonly actions = new AdminUserActions(() => this.closeUser());

	readonly #loadedUsers: AdminUser[] = $derived.by(() =>
		adminPageItems(this.usersQuery.data)
	);
	readonly users: readonly AdminUser[] = $derived.by(() =>
		this.#loadedUsers.filter(
			(user) =>
				matchesFilter(
					this.#params.current.role,
					isAdminUser(user) ? 'admin' : 'user'
				) &&
				matchesFilter(
					this.#params.current.status,
					user.banned ? 'banned' : 'active'
				)
		)
	);
	readonly #usersById = $derived.by(
		() => new Map(this.#loadedUsers.map((user) => [user.id, user]))
	);
	readonly openUserId: string | undefined = $derived.by(
		() => this.#params.current.user
	);
	readonly openUser: AdminUser | null = $derived.by(() =>
		this.openUserId ? (this.#usersById.get(this.openUserId) ?? null) : null
	);

	openDetails = (userId: string): void => {
		this.#navigateUser({ user: userId }, false);
	};

	closeUser = (): void => {
		this.#navigateUser({ user: undefined }, true);
	};

	userRowActions = (userId: string): ResourceRowAction[] => {
		const user = this.#usersById.get(userId);
		return user ? this.actions.rowActions(user) : [];
	};

	#navigateUser(
		patch: SearchParamsPatch<typeof usersSearchSchema>,
		replace: boolean
	): void {
		void goto(withSearchParams(usersSearchSchema, page.url, patch), {
			replace,
			reset: false,
		});
	}
}
