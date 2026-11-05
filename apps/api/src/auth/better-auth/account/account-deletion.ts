/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { APIError } from 'better-auth/api';
import {
	ACCOUNT_HAS_LIVE_RESOURCES_CODE,
	ACCOUNT_OWNS_SHARED_ORGANIZATIONS_CODE,
} from '../../../organization/constants/live-organization-resource.constants';
import type { OrganizationOwnershipService } from '../../../organization/services/organization-ownership.service';

export type AccountOwnership = Pick<
	OrganizationOwnershipService,
	'findSoleOwnedOrganizations' | 'findLiveResources'
>;

export async function assertAccountDeletable(
	ownership: AccountOwnership,
	userId: string
): Promise<void> {
	const soleOwned = await ownership.findSoleOwnedOrganizations(userId);
	const shared = soleOwned.filter(({ personal }) => !personal);
	if (shared.length > 0) {
		throw APIError.from('CONFLICT', {
			code: ACCOUNT_OWNS_SHARED_ORGANIZATIONS_CODE,
			message: `The account is the only owner of ${shared.map(({ name }) => name).join(', ')}. Transfer ownership or delete those organizations before deleting the account.`,
		});
	}
	const liveResources = (
		await Promise.all(
			soleOwned.map(({ id }) => ownership.findLiveResources(id))
		)
	).flat();
	if (liveResources.length === 0) return;
	throw APIError.from('CONFLICT', {
		code: ACCOUNT_HAS_LIVE_RESOURCES_CODE,
		message: `The account still owns ${[...new Set(liveResources)].join(', ')}. Delete them before deleting the account.`,
	});
}
