/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { authClient } from '#lib/api/auth/client.ts';
import { unwrapAuthResult } from '#lib/api/auth/result.ts';
import { isPendingInvitation } from './invitation-status.ts';
import { joinMemberRoles, type MemberRoles } from './member-roles.ts';
import { organizationQueryKeys } from './query-keys.ts';

export const INVITATION_RESPONSE = {
	ACCEPT: 'accept',
	REJECT: 'reject',
} as const;

export type InvitationResponse =
	(typeof INVITATION_RESPONSE)[keyof typeof INVITATION_RESPONSE];

export interface InvitationAnswer {
	invitationId: string;
	response: InvitationResponse;
}

interface InvitationRequest {
	email: string;
	roles: MemberRoles;
}

async function listInvitations(organizationId: string) {
	const invitations =
		unwrapAuthResult(
			await authClient.organization.listInvitations({
				query: { organizationId },
			})
		) ?? [];
	return invitations.filter((invitation) => isPendingInvitation(invitation));
}

export type OrganizationInvitation = Awaited<
	ReturnType<typeof listInvitations>
>[number];

async function listUserInvitations() {
	const invitations =
		unwrapAuthResult(await authClient.organization.listUserInvitations()) ?? [];
	return invitations.filter((invitation) => isPendingInvitation(invitation));
}

export type UserInvitation = Awaited<
	ReturnType<typeof listUserInvitations>
>[number];

async function answerInvitation({
	invitationId,
	response,
}: InvitationAnswer): Promise<InvitationResponse> {
	if (response === INVITATION_RESPONSE.ACCEPT) {
		unwrapAuthResult(
			await authClient.organization.acceptInvitation({ invitationId })
		);
	} else {
		unwrapAuthResult(
			await authClient.organization.rejectInvitation({ invitationId })
		);
	}
	return response;
}

export function organizationInvitationsQueryOptions(organizationId: string) {
	return queryOptions({
		queryKey: organizationQueryKeys.invitations(organizationId),
		queryFn: () => listInvitations(organizationId),
		enabled: Boolean(organizationId),
	});
}

export function userInvitationsQueryOptions() {
	return queryOptions({
		queryKey: organizationQueryKeys.userInvitations,
		queryFn: listUserInvitations,
	});
}

export function invitationQueryOptions(invitationId: string) {
	return queryOptions({
		queryKey: organizationQueryKeys.invitation(invitationId),
		queryFn: async () =>
			unwrapAuthResult(
				await authClient.organization.getInvitation({
					query: { id: invitationId },
				})
			),
		retry: false,
	});
}

export function inviteMemberMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async ({ email, roles }: InvitationRequest) =>
			unwrapAuthResult(
				await authClient.organization.inviteMember({
					organizationId,
					email,
					role: joinMemberRoles(roles),
				})
			),
		meta: {
			invalidates: [organizationQueryKeys.invitations(organizationId)],
			success: 'Invitation sent',
			failure: 'Failed to send invitation',
		},
	});
}

export function cancelInvitationMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async (invitation: OrganizationInvitation) =>
			unwrapAuthResult(
				await authClient.organization.cancelInvitation({
					invitationId: invitation.id,
				})
			),
		meta: {
			invalidates: [organizationQueryKeys.invitations(organizationId)],
			success: 'Invitation cancelled',
			failure: 'Failed to cancel invitation',
		},
	});
}

export function invitationResponseMutationOptions() {
	return mutationOptions({
		mutationFn: answerInvitation,
		meta: { invalidates: [organizationQueryKeys.userInvitations] },
	});
}
