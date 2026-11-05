/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { BillingChargeClass } from '../constants/billing.constants';
import type { BillingDailyCostDto } from '../dto/billing.dto';
import type { PlacementBillingAuthorization } from '../entities/placement-billing-authorization.entity';
import { EFFECTIVE_BILLING_LINE_AMOUNT_SQL } from '../utils/line-item/billing-line-query.util';

export type ActiveReservation = Pick<
	PlacementBillingAuthorization,
	'placementId' | 'remainingReservedMicroUsd' | 'estimatedHourlyMicroUsd'
>;

const UTC_DAY_SQL = `to_char(line."periodEnd" AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

export async function dailyCosts(
	manager: EntityManager,
	organizationId: string,
	monthStart: Date
): Promise<BillingDailyCostDto[]> {
	const rows = await manager.execute<
		{ date: string; compute: string; network: string; total: string }[]
	>(
		`SELECT ${UTC_DAY_SQL} AS date,
				COALESCE(SUM(CASE WHEN line."chargeClass" = ? THEN ${EFFECTIVE_BILLING_LINE_AMOUNT_SQL} ELSE 0 END), 0) AS compute,
				COALESCE(SUM(CASE WHEN line."chargeClass" = ? THEN ${EFFECTIVE_BILLING_LINE_AMOUNT_SQL} ELSE 0 END), 0) AS network,
				COALESCE(SUM(${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}), 0) AS total
		 FROM "billing_line_item" line
		 WHERE line."customerOrganizationId" = ? AND line."periodEnd" >= ?
		 GROUP BY ${UTC_DAY_SQL}
		 ORDER BY ${UTC_DAY_SQL} ASC`,
		[
			BillingChargeClass.COMPUTE,
			BillingChargeClass.NETWORK,
			organizationId,
			monthStart,
		]
	);
	return rows.map((row) => ({
		date: row.date,
		computeMicroUsd: row.compute,
		networkMicroUsd: row.network,
		totalMicroUsd: row.total,
	}));
}

export function activeReservations(
	manager: EntityManager,
	organizationId: string
): Promise<ActiveReservation[]> {
	return manager.execute<ActiveReservation[]>(
		`SELECT "placementId",
				"remainingReservedMicroUsd",
				"estimatedHourlyMicroUsd"
		 FROM "placement_billing_authorization"
		 WHERE "customerOrganizationId" = ? AND "releasedAt" IS NULL`,
		[organizationId]
	);
}
