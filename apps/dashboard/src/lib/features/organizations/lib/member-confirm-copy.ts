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
			{ text: member?.user.email ?? '', bold: true },
			' loses access to this organization immediately.',
		],
		confirmLabel: 'Remove',
	};
}

export function revokeInvitationCopy(
	invitation: OrganizationInvitation | null
): ChipConfirmCopy {
	return {
		title: 'Revoke invitation',
		text: [
			{ text: invitation?.email ?? '', bold: true },
			' can no longer join with this invitation.',
		],
		confirmLabel: 'Revoke',
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
			" fails while members still hold it. Reassign them first. This can't be undone.",
		],
		confirmLabel: 'Delete',
	};
}
