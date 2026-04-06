/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Organization } from '@snapflow/api-client';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { suspend } from 'suspend-react';
import { apiClient } from '@/api/api-client';
import {
	OrganizationsContext,
	type OrganizationsContextImplementation,
} from '@/context/organizations-context';
import { handleApiError } from '@/lib/errors';

export function OrganizationsProvider(props: { children: ReactNode }) {
	const organizationsApi = apiClient.organizationsApi;

	const getOrganizations = useCallback(async () => {
		try {
			return (await organizationsApi.listOrganizations()).data;
		} catch (error) {
			handleApiError(error, 'Failed to fetch your organizations');
			throw error;
		}
	}, []);

	const [organizations, setOrganizations] = useState<Organization[]>(
		suspend(getOrganizations, [organizationsApi, 'organizations'])
	);

	const refreshOrganizations = useCallback(async () => {
		const orgs = await getOrganizations();
		setOrganizations(orgs);
		return orgs;
	}, [getOrganizations]);

	const contextValue: OrganizationsContextImplementation = useMemo(() => {
		return {
			organizations,
			setOrganizations,
			refreshOrganizations,
		};
	}, [organizations, refreshOrganizations]);

	return (
		<OrganizationsContext.Provider value={contextValue}>
			{props.children}
		</OrganizationsContext.Provider>
	);
}
