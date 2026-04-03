/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useContext } from 'react';
import { SelectedOrganizationContext } from '@/context/selected-organization-context';

export function useSelectedOrganization() {
	const context = useContext(SelectedOrganizationContext);

	if (!context) {
		throw new Error(
			'useSelectedOrganization must be used within a SelectedOrganizationProvider'
		);
	}

	return context;
}
