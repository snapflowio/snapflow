/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	AccountDeletionBlockersDto,
	HeldFund,
	LiveOrganizationResource,
	OrganizationDeletionBlockersDto,
} from '@snapflow/api-client';

const LIVE_RESOURCE_STEP = {
	sandboxes: 'Delete the remaining sandboxes',
	snapshots: 'Delete the remaining snapshots',
	volumes: 'Delete the remaining volumes',
	machines: 'Decommission the remaining machines',
	registries: 'Remove the remaining registries',
	secrets: 'Delete the remaining secrets',
	exposures: 'Remove the remaining previews and exposures',
} as const satisfies Record<LiveOrganizationResource, string>;

const HELD_FUND_STEP = {
	escrow_balance: 'Withdraw the escrow balance',
	frozen_escrow: 'Wait for the frozen escrow funds to be reviewed and released',
	open_payment_channels: 'Let open payment channels finish billing and settle',
	host_earnings: 'Pay out the remaining host earnings',
	ledger_credit: 'Wait for Snapflow to refund the billing credit it owes you',
	wallet_usdc: 'Move the USDC out of your wallet',
} as const satisfies Record<HeldFund, string>;

export function deletionSteps(
	blockers: OrganizationDeletionBlockersDto | AccountDeletionBlockersDto
): string[] {
	const sharedOrganizations =
		'sharedOrganizations' in blockers ? blockers.sharedOrganizations : [];
	return [
		...sharedOrganizations.map(
			(name) => `Transfer ownership of ${name} or delete it`
		),
		...blockers.liveResources.map((resource) => LIVE_RESOURCE_STEP[resource]),
		...blockers.heldFunds.map((fund) => HELD_FUND_STEP[fund]),
	];
}
