/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useContext } from 'react';
import { UserOrganizationInvitationsContext } from '@/context/user-organization-invitations-context';

export function useUserOrganizationInvitations() {
	const context = useContext(UserOrganizationInvitationsContext);

	if (!context) {
		throw new Error(
			'useUserOrganizationInvitations must be used within a UserOrganizationInvitationsProvider'
		);
	}

	return context;
}
