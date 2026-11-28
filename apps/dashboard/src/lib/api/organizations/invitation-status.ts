/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const PENDING_INVITATION_STATUS = 'pending';

interface InvitationState {
	expiresAt: Date | string;
	status: string;
}

export function isPendingInvitation(
	invitation: InvitationState,
	now: number = Date.now()
): boolean {
	return (
		invitation.status === PENDING_INVITATION_STATUS &&
		new Date(invitation.expiresAt).getTime() > now
	);
}
