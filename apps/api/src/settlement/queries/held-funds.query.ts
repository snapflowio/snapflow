/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { BillingEvidenceStatus } from '../../billing/constants/billing.constants';
import type { EscrowIdentity } from '../types/escrow.types';

const CUSTOMER_BILLING_UNSETTLED_SQL = `SELECT EXISTS (
		SELECT 1 FROM payment_channel_charge charge
		JOIN payment_channel channel ON channel.id = charge."paymentChannelId"
		WHERE channel."chainId" = ? AND channel."contractAddress" = ?
		  AND channel."customerOrganizationId" = ?
		  AND charge."settledAt" IS NULL
	) OR EXISTS (
		SELECT 1 FROM billing_line_item line
		WHERE line."customerOrganizationId" = ? AND line."evidenceStatus" = ?
	) AS unsettled`;

export async function customerBillingUnsettled(
	manager: EntityManager,
	escrow: EscrowIdentity,
	organizationId: string
): Promise<boolean> {
	const [row] = await manager.execute<{ unsettled: boolean }[]>(
		CUSTOMER_BILLING_UNSETTLED_SQL,
		[
			escrow.chainId,
			escrow.contractAddress,
			organizationId,
			organizationId,
			BillingEvidenceStatus.PENDING,
		]
	);
	return row?.unsettled ?? false;
}

const HOST_FUNDS_HELD_SQL = `SELECT EXISTS (
		SELECT 1 FROM machine_host_key k
		JOIN machine m ON m.id = k."machineId"
		JOIN escrow_account account
			ON account."chainId" = ? AND account."contractAddress" = ? AND account.address = k.address
		WHERE m."organizationId" = ?
		  AND (account."hostBalanceMicroUsd" > 0 OR account."frozenMicroUsd" > 0)
	) OR EXISTS (
		SELECT 1 FROM machine_host_key k
		JOIN machine m ON m.id = k."machineId"
		JOIN payment_channel channel
			ON channel."chainId" = ? AND channel."contractAddress" = ? AND channel."hostAddress" = k.address
		WHERE m."organizationId" = ?
		  AND channel."chargedMicroUsd" > channel."claimedMicroUsd"
	) AS held`;

export async function hostFundsHeld(
	manager: EntityManager,
	escrow: EscrowIdentity,
	organizationId: string
): Promise<boolean> {
	const identity = [escrow.chainId, escrow.contractAddress, organizationId];
	const [row] = await manager.execute<{ held: boolean }[]>(
		HOST_FUNDS_HELD_SQL,
		[...identity, ...identity]
	);
	return row?.held ?? false;
}
