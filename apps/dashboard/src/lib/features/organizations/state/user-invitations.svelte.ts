/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	INVITATION_RESPONSE,
	type InvitationAnswer,
	invitationResponseMutationOptions,
	userInvitationsQueryOptions,
} from '#lib/api/organizations/invitations.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export class UserInvitations {
	readonly #auth = getAuth();

	readonly invitationsQuery = createQuery(() => userInvitationsQueryOptions());
	readonly respondMutation = createMutation(() => {
		const options = invitationResponseMutationOptions();
		return {
			...options,
			meta: { ...options.meta, failure: 'Failed to respond to the invitation' },
		};
	});

	readonly invitations = $derived(this.invitationsQuery.data ?? []);

	answer = (input: InvitationAnswer): void => {
		this.respondMutation.mutate(input, {
			onSuccess: async (response) => {
				if (response === INVITATION_RESPONSE.ACCEPT) {
					await this.#auth.refetchOrganizations();
					toast.success('Invitation accepted');
					await goto(resolve(Path.DASHBOARD));
					return;
				}
				toast.success('Invitation declined');
			},
		});
	};
}
