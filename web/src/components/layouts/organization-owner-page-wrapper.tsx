/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OrganizationUserRoleEnum } from '@snapflow/api-client';
import { Navigate } from 'react-router';
import { Path } from '@/constants/paths';
import { useSelectedOrganization } from '@/hooks/use-selected-organization';

export function OrganizationOwnerPageWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const { authenticatedUserOrganizationMember } = useSelectedOrganization();

	const isOwner =
		authenticatedUserOrganizationMember?.role ===
		OrganizationUserRoleEnum.OWNER;

	if (!isOwner) {
		return <Navigate to={Path.DASHBOARD} replace={true} />;
	}

	return children;
}
