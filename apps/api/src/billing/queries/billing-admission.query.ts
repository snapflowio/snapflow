/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { SECONDS_PER_HOUR } from '../../common/constants/time.constants';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { CAPACITY_HOLD } from '../../sandbox/values/sandbox-hold-policy.value';
import { BillingEvidenceStatus } from '../constants/billing.constants';
import { HostExposureScope } from '../constants/billing-admission.constants';
import { FUNDING_POLICY } from '../constants/funding.constants';
import { EFFECTIVE_BILLING_LINE_AMOUNT_SQL } from '../utils/line-item/billing-line-query.util';

const LINE_EXPOSURE_COLUMN = {
	[HostExposureScope.MACHINE]: 'line."machineId"',
	[HostExposureScope.HOST]: 'line."hostOrganizationId"',
} as const satisfies Record<HostExposureScope, string>;

const RESERVATION_EXPOSURE_COLUMN = {
	[HostExposureScope.MACHINE]: 'placement."machineId"',
	[HostExposureScope.HOST]: 'billing_authorization."hostOrganizationId"',
} as const satisfies Record<HostExposureScope, string>;

function optionalAmount(value: string | undefined): MicroUsd {
	return value === undefined ? MicroUsd.ZERO : MicroUsd.parse(value);
}

export async function monthSpend(
	manager: EntityManager,
	organizationId: string,
	monthStart: Date
): Promise<MicroUsd> {
	const [row] = await manager.execute<{ total: string }[]>(
		`SELECT COALESCE(SUM(${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}), 0) AS total
		 FROM "billing_line_item" line
		 WHERE line."customerOrganizationId" = ?
		   AND line."periodEnd" >= ?`,
		[organizationId, monthStart]
	);
	return optionalAmount(row?.total);
}

export async function unpostedHostExposures(
	manager: EntityManager,
	scope: HostExposureScope,
	references: readonly string[]
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
	const computeHold = CAPACITY_HOLD.computeSql('sandbox');
	const running = await manager.execute<{ reference: string; total: string }[]>(
		`SELECT ${RESERVATION_EXPOSURE_COLUMN[scope]}::text AS reference,
				COALESCE(CEIL(SUM(billing_authorization."estimatedHourlyMicroUsd") * ? / ?), 0) AS total
		 FROM "placement_billing_authorization" billing_authorization
		 INNER JOIN "sandbox_placement" placement
			ON placement.id = billing_authorization."placementId"
		 INNER JOIN "sandbox" sandbox
			ON sandbox.id = billing_authorization."sandboxId"
		 WHERE billing_authorization."releasedAt" IS NULL
		   AND ${computeHold.sql}
		   AND ${RESERVATION_EXPOSURE_COLUMN[scope]}::text = ANY(ARRAY[?]::text[])
		 GROUP BY 1`,
		[
			FUNDING_POLICY.startCoverageSeconds,
			SECONDS_PER_HOUR,
			...computeHold.bindings,
			references,
		]
	);
	for (const { reference, total } of [...lines, ...running]) {
		exposures.set(
			reference,
			(exposures.get(reference) ?? MicroUsd.ZERO).add(MicroUsd.parse(total))
		);
	}
	return exposures;
}
