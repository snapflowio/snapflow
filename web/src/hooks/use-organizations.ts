/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useContext } from 'react';
import { OrganizationsContext } from '@/context/organizations-context';

export function useOrganizations() {
	const context = useContext(OrganizationsContext);

	if (!context) {
		throw new Error(
			'useOrganizations must be used within a OrganizationsProvider'
		);
	}

	return context;
}
