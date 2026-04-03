/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { OrganizationRole } from '@snapflow/api-client';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/api/api-client';
import { useSelectedOrganization } from '@/hooks/use-selected-organization';
import { handleApiError } from '@/lib/errors';

export function useOrganizationRoles() {
	const organizationsApi = apiClient.organizationsApi;
	const { selectedOrganization } = useSelectedOrganization();

	const [roles, setRoles] = useState<OrganizationRole[]>([]);
	const [loadingRoles, setLoadingRoles] = useState(true);

	const fetchRoles = useCallback(
		async (showTableLoadingState = true) => {
			if (!selectedOrganization) return;
			if (showTableLoadingState) setLoadingRoles(true);

			try {
				const response = await organizationsApi.listOrganizationRoles(
					selectedOrganization.id
				);
				setRoles(response.data);
			} catch (error) {
				handleApiError(error, 'Failed to fetch organization roles');
			} finally {
				setLoadingRoles(false);
			}
		},
		[organizationsApi, selectedOrganization]
	);

	useEffect(() => {
		fetchRoles();
	}, [fetchRoles]);

	return {
		roles,
		loadingRoles,
		refreshRoles: fetchRoles,
	};
}
