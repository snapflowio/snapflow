/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { parseDatabaseTimestamp } from '../../../infra/database/utils/database-time.util';
import {
	BillingChargeClass,
	BillingEvidenceStatus,
} from '../constants/billing.constants';
import { HostExposureScope } from '../constants/billing-admission.constants';
import type { RecentNetworkUsage } from '../utils/ledger/billing-reservation.util';
import { EFFECTIVE_BILLING_LINE_AMOUNT_SQL } from '../utils/line-item/billing-line-query.util';

export interface MonthSpend {
	totalMicroUsd: MicroUsd;
	networkMicroUsd: MicroUsd;
}

const LINE_EXPOSURE_COLUMN = {
	[HostExposureScope.MACHINE]: 'line."machineId"',
	[HostExposureScope.HOST]: 'line."hostOrganizationId"',
} as const satisfies Record<HostExposureScope, string>;

const RESERVATION_EXPOSURE_COLUMN = {
	[HostExposureScope.MACHINE]: 'placement."machineId"',
	[HostExposureScope.HOST]: 'billing_authorization."hostOrganizationId"',
} as const satisfies Record<HostExposureScope, string>;

const EXCLUDED_PLACEMENT_CLAUSE =
	'AND billing_authorization."placementId" <> ?';

function optionalAmount(value: string | undefined): MicroUsd {
	return value === undefined ? MicroUsd.ZERO : MicroUsd.parse(value);
}

export async function monthSpend(
	manager: EntityManager,
	organizationId: string,
	monthStart: Date
): Promise<MonthSpend> {
	const [row] = await manager.execute<{ total: string; network: string }[]>(
		`SELECT COALESCE(SUM(${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}), 0) AS total,
				COALESCE(SUM(CASE
					WHEN line."chargeClass" = ?
					THEN ${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}
					ELSE 0
				END), 0) AS network
		 FROM "billing_line_item" line
		 WHERE line."customerOrganizationId" = ?
		   AND line."periodEnd" >= ?`,
		[BillingChargeClass.NETWORK, organizationId, monthStart]
	);
	return {
		totalMicroUsd: optionalAmount(row?.total),
		networkMicroUsd: optionalAmount(row?.network),
	};
}

export async function unpostedCharges(
	manager: EntityManager,
	organizationId: string
): Promise<MicroUsd> {
	const [row] = await manager.execute<{ total: string }[]>(
		`SELECT COALESCE(SUM(${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}), 0) AS total
		 FROM "billing_line_item" line
		 WHERE line."customerOrganizationId" = ?
		   AND line."evidenceStatus" = ?`,
		[organizationId, BillingEvidenceStatus.PENDING]
	);
	return optionalAmount(row?.total);
}

export async function activeReservationTotal(
	manager: EntityManager,
	organizationId: string,
	excludedPlacementId?: string
): Promise<MicroUsd> {
	const [row] = await manager.execute<{ total: string }[]>(
		`SELECT COALESCE(SUM(billing_authorization."remainingReservedMicroUsd"), 0) AS total
		 FROM "placement_billing_authorization" billing_authorization
		 WHERE billing_authorization."customerOrganizationId" = ?
		   AND billing_authorization."releasedAt" IS NULL
		   ${excludedPlacementId ? EXCLUDED_PLACEMENT_CLAUSE : ''}`,
		excludedPlacementId
			? [organizationId, excludedPlacementId]
			: [organizationId]
	);
	return optionalAmount(row?.total);
}

export async function unpostedHostExposures(
	manager: EntityManager,
	scope: HostExposureScope,
	references: readonly string[],
	excludedPlacementId?: string
): Promise<Map<string, MicroUsd>> {
	const exposures = new Map<string, MicroUsd>(
		references.map((reference) => [reference, MicroUsd.ZERO])
	);
	if (references.length === 0) return exposures;
	const lines = await manager.execute<{ reference: string; total: string }[]>(
		`SELECT ${LINE_EXPOSURE_COLUMN[scope]}::text AS reference,
				COALESCE(SUM(${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}), 0) AS total
		 FROM "billing_line_item" line
		 WHERE line."evidenceStatus" = ?
		   AND line."hostOrganizationId" IS NOT NULL
		   AND ${LINE_EXPOSURE_COLUMN[scope]}::text = ANY(ARRAY[?]::text[])
		 GROUP BY 1`,
		[BillingEvidenceStatus.PENDING, references]
	);
	const reservations = await manager.execute<
		{ reference: string; total: string }[]
	>(
		`SELECT ${RESERVATION_EXPOSURE_COLUMN[scope]}::text AS reference,
				COALESCE(SUM(billing_authorization."remainingReservedMicroUsd"), 0) AS total
		 FROM "placement_billing_authorization" billing_authorization
		 INNER JOIN "sandbox_placement" placement
			ON placement.id = billing_authorization."placementId"
		 WHERE billing_authorization."releasedAt" IS NULL
		   AND ${RESERVATION_EXPOSURE_COLUMN[scope]}::text = ANY(ARRAY[?]::text[])
		   ${excludedPlacementId ? EXCLUDED_PLACEMENT_CLAUSE : ''}
		 GROUP BY 1`,
		excludedPlacementId ? [references, excludedPlacementId] : [references]
	);
	for (const { reference, total } of [...lines, ...reservations]) {
		exposures.set(
			reference,
			(exposures.get(reference) ?? MicroUsd.ZERO).add(MicroUsd.parse(total))
		);
	}
	return exposures;
}

export async function recentNetworkUsage(
	manager: EntityManager,
	organizationId: string,
	since: Date
): Promise<RecentNetworkUsage> {
	const [row] = await manager.execute<{ total: string; startedAt: unknown }[]>(
		`SELECT COALESCE(SUM(${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}), 0) AS total,
				MIN(line."periodStart") AS "startedAt"
		 FROM "billing_line_item" line
		 WHERE line."customerOrganizationId" = ?
		   AND line."chargeClass" = ?
		   AND line."evidenceStatus" = ?
		   AND line."periodEnd" >= ?`,
		[
			organizationId,
			BillingChargeClass.NETWORK,
			BillingEvidenceStatus.CORROBORATED,
			since,
		]
	);
	return {
		totalMicroUsd: optionalAmount(row?.total),
		startedAt: row?.startedAt ? parseDatabaseTimestamp(row.startedAt) : null,
	};
}
