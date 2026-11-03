/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const ORGANIZATION_QUERY_ROOT = 'organization';

export const organizationQueryKeys = {
	members: (organizationId: string) =>
		[ORGANIZATION_QUERY_ROOT, organizationId, 'members'] as const,
	invitations: (organizationId: string) =>
		[ORGANIZATION_QUERY_ROOT, organizationId, 'invitations'] as const,
	roles: (organizationId: string) =>
		[ORGANIZATION_QUERY_ROOT, organizationId, 'roles'] as const,
	apiKeys: (organizationId: string) =>
		[ORGANIZATION_QUERY_ROOT, organizationId, 'api-keys'] as const,
	userInvitations: [ORGANIZATION_QUERY_ROOT, 'user-invitations'] as const,
	invitation: (invitationId: string) =>
		[ORGANIZATION_QUERY_ROOT, 'invitation', invitationId] as const,
};
