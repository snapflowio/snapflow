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
import {
	HELD_FUND_LABEL,
	type HeldFund,
	HeldFundsErrorCode,
} from '../../../settlement/constants/held-funds.constants';
import type { HeldFundsService } from '../../../settlement/services/funds/held-funds.service';
import { isChainUnreachable } from '../../../settlement/utils/chain-error.util';
import type { AccountDeletionBlockersDto } from '../../dto/deletion-blockers.dto';

export const ACCOUNT_FUNDS_UNREADABLE_MESSAGE =
	'Your wallet balance cannot be read right now; retry shortly before deleting your account';

export interface AccountDeletionDependencies {
	ownership: Pick<
		OrganizationOwnershipService,
		'findSoleOwnedOrganizations' | 'findLiveResources'
	>;
	heldFunds: Pick<HeldFundsService, 'organization' | 'wallet'>;
}

async function accountHeldFunds(
	{ heldFunds }: AccountDeletionDependencies,
	userId: string,
	organizationIds: readonly string[]
): Promise<HeldFund[]> {
	const held = await Promise.all([
		heldFunds.wallet(userId),
		...organizationIds.map((id) => heldFunds.organization(id)),
	]);
	return [...new Set(held.flat())];
}

async function readableBlockers(
	dependencies: AccountDeletionDependencies,
	userId: string
): Promise<AccountDeletionBlockersDto> {
	try {
		return await accountDeletionBlockers(dependencies, userId);
	} catch (error) {
		if (!isChainUnreachable(error)) throw error;
		throw APIError.from('SERVICE_UNAVAILABLE', {
			code: HeldFundsErrorCode.FUNDS_UNREADABLE,
			message: ACCOUNT_FUNDS_UNREADABLE_MESSAGE,
		});
	}
}

export async function accountDeletionBlockers(
	dependencies: AccountDeletionDependencies,
	userId: string
): Promise<AccountDeletionBlockersDto> {
	const { ownership } = dependencies;
	const soleOwned = await ownership.findSoleOwnedOrganizations(userId);
	const [liveResources, heldFunds] = await Promise.all([
		Promise.all(soleOwned.map(({ id }) => ownership.findLiveResources(id))),
		accountHeldFunds(
			dependencies,
			userId,
			soleOwned.map(({ id }) => id)
		),
	]);
	return {
		sharedOrganizations: soleOwned
			.filter(({ personal }) => !personal)
			.map(({ name }) => name),
		liveResources: [...new Set(liveResources.flat())],
		heldFunds,
	};
}

export async function assertAccountDeletable(
	dependencies: AccountDeletionDependencies,
	userId: string
): Promise<void> {
	const { sharedOrganizations, liveResources, heldFunds } =
		await readableBlockers(dependencies, userId);
	if (sharedOrganizations.length > 0) {
		throw APIError.from('CONFLICT', {
			code: ACCOUNT_OWNS_SHARED_ORGANIZATIONS_CODE,
			message: `The account is the only owner of ${sharedOrganizations.join(', ')}. Transfer ownership or delete those organizations before deleting the account.`,
		});
	}
	if (liveResources.length > 0) {
		throw APIError.from('CONFLICT', {
			code: ACCOUNT_HAS_LIVE_RESOURCES_CODE,
			message: `The account still owns ${liveResources.join(', ')}. Delete them before deleting the account.`,
		});
	}
	if (heldFunds.length === 0) return;
	throw APIError.from('CONFLICT', {
		code: HeldFundsErrorCode.ACCOUNT_HOLDS_FUNDS,
		message: `The account still holds ${heldFunds.map((fund) => HELD_FUND_LABEL[fund]).join(', ')}. Withdraw them before deleting the account.`,
	});
}
