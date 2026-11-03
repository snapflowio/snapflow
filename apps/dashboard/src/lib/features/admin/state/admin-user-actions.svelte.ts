/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Ban from '@lucide/svelte/icons/ban';
import Copy from '@lucide/svelte/icons/copy';
import LogOut from '@lucide/svelte/icons/log-out';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import ShieldOff from '@lucide/svelte/icons/shield-off';
import Trash from '@lucide/svelte/icons/trash-2';
import VenetianMask from '@lucide/svelte/icons/venetian-mask';
import type { AdminUser } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import {
	type AdminUserBan,
	banUserMutationOptions,
	impersonateUserMutationOptions,
	removeUserMutationOptions,
	revokeUserSessionsMutationOptions,
	setUserRoleMutationOptions,
	unbanUserMutationOptions,
} from '#lib/api/admin/users.ts';
import { AUTH_ROLE, hasAuthRole } from '#lib/api/auth/role.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { copyId } from '#lib/features/admin/lib/admin-list.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export type AdminUserDialogKind = 'ban' | 'role' | 'revokeSessions' | 'remove';

export interface AdminUserDialog {
	kind: AdminUserDialogKind;
	user: AdminUser;
}

export function isAdminUser(user: AdminUser): boolean {
	return hasAuthRole(user.role, AUTH_ROLE.ADMIN);
}

export function secondFactorLabel(user: AdminUser): string {
	if (user.twoFactorEnabled && user.passkeyRegistered)
		return 'TOTP and passkey';
	if (user.twoFactorEnabled) return 'TOTP';
	if (user.passkeyRegistered) return 'Passkey';
	return 'None';
}

export class AdminUserActions {
	readonly #auth = getAuth();
	readonly #onRemoved: (user: AdminUser) => void;
	dialog = $state.raw<AdminUserDialog | null>(null);
	impersonatingId = $state<string | null>(null);

	readonly setRole = createMutation(() => setUserRoleMutationOptions());
	readonly ban = createMutation(() => banUserMutationOptions());
	readonly unban = createMutation(() => unbanUserMutationOptions());
	readonly revokeSessions = createMutation(() =>
		revokeUserSessionsMutationOptions()
	);
	readonly remove = createMutation(() => removeUserMutationOptions());
	readonly impersonate = createMutation(() => ({
		...impersonateUserMutationOptions(),
		onSuccess: async () => {
			await this.#auth.refetch();
			await goto(resolve(Path.SANDBOXES), { replace: true });
		},
		onSettled: () => {
			this.impersonatingId = null;
		},
	}));

	constructor(onRemoved: (user: AdminUser) => void = () => {}) {
		this.#onRemoved = onRemoved;
	}

	isSelf = (user: AdminUser): boolean => user.id === this.#auth.user?.id;

	open = (kind: AdminUserDialogKind, user: AdminUser): void => {
		this.dialog = { kind, user };
	};

	close = (): void => {
		this.dialog = null;
	};

	startImpersonation = (user: AdminUser): void => {
		if (this.impersonatingId !== null) return;
		this.impersonatingId = user.id;
		this.impersonate.mutate(user);
	};

	confirmRole = (): void => {
		const dialog = this.dialog;
		if (dialog?.kind !== 'role') return;
		this.setRole.mutate(
			{
				user: dialog.user,
				role: isAdminUser(dialog.user) ? AUTH_ROLE.USER : AUTH_ROLE.ADMIN,
			},
			{ onSuccess: this.close }
		);
	};

	confirmBan = (ban: AdminUserBan): Promise<unknown> =>
		this.ban.mutateAsync(ban, { onSuccess: this.close });

	confirmRevokeSessions = (): void => {
		const dialog = this.dialog;
		if (dialog?.kind !== 'revokeSessions') return;
		this.revokeSessions.mutate(dialog.user, { onSuccess: this.close });
	};

	confirmRemove = (): void => {
		const dialog = this.dialog;
		if (dialog?.kind !== 'remove') return;
		const removed = dialog.user;
		this.remove.mutate(removed, {
			onSuccess: () => {
				this.close();
				this.#onRemoved(removed);
			},
		});
	};

	rowActions = (user: AdminUser): ResourceRowAction[] => {
		const self = this.isSelf(user);
		const admin = isAdminUser(user);
		return [
			{
				icon: VenetianMask,
				label: 'Impersonate',
				onSelect: () => this.startImpersonation(user),
				disabled: this.impersonatingId !== null,
				visible: !self,
			},
			{
				icon: admin ? ShieldOff : ShieldCheck,
				label: admin ? 'Demote' : 'Promote',
				onSelect: () => this.open('role', user),
				visible: !self,
			},
			{
				icon: LogOut,
				label: 'Sign out everywhere',
				onSelect: () => this.open('revokeSessions', user),
				visible: !self,
			},
			user.banned
				? {
						icon: RotateCcw,
						label: 'Unban',
						onSelect: () => this.unban.mutate(user),
						disabled: this.unban.isPending,
						visible: !self,
					}
				: {
						icon: Ban,
						label: 'Ban',
						onSelect: () => this.open('ban', user),
						visible: !self,
					},
			{ icon: Copy, label: 'Copy ID', onSelect: () => copyId(user.id) },
			{
				icon: Trash,
				label: 'Delete',
				onSelect: () => this.open('remove', user),
				separated: true,
				visible: !self,
			},
		];
	};
}
