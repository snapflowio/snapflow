/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AdminListUsersData, AdminUser } from '@snapflow/api-client';
import {
	adminListUsersInfiniteOptions,
	adminListUsersQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import { authClient } from '#lib/api/auth/client.ts';
import { unwrapAuthResult } from '#lib/api/auth/result.ts';
import { AUTH_ROLE, type AuthRole } from '#lib/api/auth/role.ts';
import { appMutationOptions } from '#lib/api/client/mutation-meta.ts';

export interface AdminUserBan {
	banExpiresIn?: number;
	banReason: string;
	user: AdminUser;
}

export interface AdminRoleChange {
	role: AuthRole;
	user: AdminUser;
}

const invalidates = [adminListUsersQueryKey()];

export function adminUsersInfiniteQueryOptions(
	query: AdminListUsersData['query']
) {
	return adminListUsersInfiniteOptions({ query });
}

export function setUserRoleMutationOptions() {
	return appMutationOptions({
		mutationFn: async ({ role, user }: AdminRoleChange) => {
			unwrapAuthResult(
				await authClient.admin.setRole({ userId: user.id, role })
			);
			return role;
		},
		meta: {
			success: (role) =>
				role === AUTH_ROLE.ADMIN
					? 'Administrator added'
					: 'Administrator removed',
			failure: 'Failed to change the user role',
			invalidates,
		},
	});
}

export function banUserMutationOptions() {
	return mutationOptions({
		mutationFn: async ({ banExpiresIn, banReason, user }: AdminUserBan) =>
			unwrapAuthResult(
				await authClient.admin.banUser({
					userId: user.id,
					banReason,
					banExpiresIn,
				})
			),
		meta: {
			success: 'User banned',
			failure: 'Failed to ban user',
			invalidates,
		},
	});
}

export function unbanUserMutationOptions() {
	return mutationOptions({
		mutationFn: async (user: AdminUser) =>
			unwrapAuthResult(await authClient.admin.unbanUser({ userId: user.id })),
		meta: {
			success: 'User unbanned',
			failure: 'Failed to unban user',
			invalidates,
		},
	});
}

export function revokeUserSessionsMutationOptions() {
	return mutationOptions({
		mutationFn: async (user: AdminUser) =>
			unwrapAuthResult(
				await authClient.admin.revokeUserSessions({ userId: user.id })
			),
		meta: {
			success: 'User signed out everywhere',
			failure: 'Failed to revoke user sessions',
			invalidates,
		},
	});
}

export function removeUserMutationOptions() {
	return mutationOptions({
		mutationFn: async (user: AdminUser) =>
			unwrapAuthResult(await authClient.admin.removeUser({ userId: user.id })),
		meta: {
			success: 'User deleted',
			failure: 'Failed to delete user',
			invalidates,
		},
	});
}

export function stopImpersonatingMutationOptions() {
	return mutationOptions({
		mutationFn: async () =>
			unwrapAuthResult(await authClient.admin.stopImpersonating()),
		meta: { failure: 'Failed to stop impersonating' },
	});
}

export function impersonateUserMutationOptions() {
	return mutationOptions({
		mutationFn: async (user: AdminUser) =>
			unwrapAuthResult(
				await authClient.admin.impersonateUser({ userId: user.id })
			),
		meta: { failure: 'Failed to impersonate user' },
	});
}
