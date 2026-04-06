/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Organization } from '@snapflow/api-client';
import { createContext } from 'react';

export interface OrganizationsContextImplementation {
	organizations: Organization[];
	refreshOrganizations: () => Promise<Organization[]>;
}

export const OrganizationsContext = createContext<
	OrganizationsContextImplementation | undefined
>(undefined);
