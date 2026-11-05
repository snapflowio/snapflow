/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { OrganizationAccessService } from '../../../auth/services/organization-access.service';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { permissionPairs } from '../../../organization/utils/organization-permissions.util';

const MANAGED_SECRET_USE_PERMISSIONS = permissionPairs({ secrets: ['use'] });

export async function canUseManagedSecrets(
	organizationAccess: OrganizationAccessService,
	authContext: OrganizationAuthContext
): Promise<boolean> {
	const granted = await organizationAccess.grantedToContext(
		authContext,
		MANAGED_SECRET_USE_PERMISSIONS
	);
	return granted.length === MANAGED_SECRET_USE_PERMISSIONS.length;
}
