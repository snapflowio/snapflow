/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { OrganizationInvitation } from '#lib/api/organizations/invitations.ts';
import type { OrganizationMember } from '#lib/api/organizations/members.ts';
import type { OrganizationCustomRole } from '#lib/api/organizations/roles.ts';
import type { ChipConfirmCopy } from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';

export function removeMemberCopy(
	member: OrganizationMember | null
): ChipConfirmCopy {
	return {
		title: 'Remove member',
		text: [
			'Are you sure you want to remove ',
			{ text: member?.user.email ?? '', bold: true },
			' from the organization? ',
			{ text: 'They immediately lose access.', error: true },
			' This action cannot be undone.',
		],
		confirmLabel: 'Remove',
		pendingLabel: 'Removing...',
	};
}

export function revokeInvitationCopy(
	invitation: OrganizationInvitation | null
): ChipConfirmCopy {
	return {
		title: 'Revoke invite',
		text: [
			'Revoking the invite for ',
			{ text: invitation?.email ?? '', bold: true },
			' ',
			{ text: 'means they can no longer join with it.', error: true },
		],
		confirmLabel: 'Revoke',
		pendingLabel: 'Revoking...',
	};
}

export function deleteRoleCopy(
	role: OrganizationCustomRole | null
): ChipConfirmCopy {
	return {
		title: 'Delete role',
		text: [
			'Deleting ',
			{ text: role?.role ?? '', bold: true },
			' ',
			{
				text: 'fails while members still hold it; reassign them first.',
				error: true,
			},
			' This action cannot be undone.',
		],
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting...',
	};
}
