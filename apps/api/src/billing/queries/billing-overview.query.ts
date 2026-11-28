/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { BillingDailyCostDto } from '../dto/billing.dto';
import { EFFECTIVE_BILLING_LINE_AMOUNT_SQL } from '../utils/line-item/billing-line-query.util';

const UTC_DAY_SQL = `to_char(line."periodEnd" AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

export function dailyCosts(
	manager: EntityManager,
	organizationId: string,
	monthStart: Date
): Promise<BillingDailyCostDto[]> {
	return manager.execute<BillingDailyCostDto[]>(
		`SELECT ${UTC_DAY_SQL} AS date,
				COALESCE(SUM(${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}), 0)::text AS "totalMicroUsd"
		 FROM "billing_line_item" line
		 WHERE line."customerOrganizationId" = ? AND line."periodEnd" >= ?
		 GROUP BY ${UTC_DAY_SQL}
		 ORDER BY ${UTC_DAY_SQL} ASC`,
		[organizationId, monthStart]
	);
}
