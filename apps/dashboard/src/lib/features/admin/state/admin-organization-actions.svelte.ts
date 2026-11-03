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
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import type { AdminOrganization } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import {
	type AdminOrganizationSuspension,
	suspendOrganizationMutationOptions,
	unsuspendOrganizationMutationOptions,
} from '#lib/api/admin/organizations.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { copyId } from '#lib/features/admin/lib/admin-list.ts';

export class AdminOrganizationActions {
	suspending = $state.raw<AdminOrganization | null>(null);
	unsuspending = $state.raw<AdminOrganization | null>(null);

	readonly suspend = createMutation(() => suspendOrganizationMutationOptions());
	readonly unsuspend = createMutation(() =>
		unsuspendOrganizationMutationOptions()
	);

	close = (): void => {
		this.suspending = null;
		this.unsuspending = null;
	};

	confirmSuspend = (
		suspension: AdminOrganizationSuspension
	): Promise<unknown> =>
		this.suspend.mutateAsync(suspension, { onSuccess: this.close });

	confirmUnsuspend = (): void => {
		if (this.unsuspending) {
			this.unsuspend.mutate(this.unsuspending, { onSuccess: this.close });
		}
	};

	rowActions = (organization: AdminOrganization): ResourceRowAction[] => {
		const active = !organization.deletedAt;
		return [
			{
				icon: RotateCcw,
				label: 'Unsuspend',
				onSelect: () => {
					this.unsuspending = organization;
				},
				visible: active && organization.suspended,
			},
			{
				icon: Ban,
				label: 'Suspend',
				onSelect: () => {
					this.suspending = organization;
				},
				visible: active && !organization.suspended,
			},
			{
				icon: Copy,
				label: 'Copy ID',
				onSelect: () => copyId(organization.id),
			},
		];
	};
}
