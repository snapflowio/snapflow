/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { BillingPeriod } from '../../billing/utils/billing-period.util';
import { MicroUsd } from '../../common/values/micro-usd.value';

// Everything an organization was charged for platform services in a month:
// the private pool fees of the days its machines spent in the pool.
export async function platformServiceCharges(
	manager: EntityManager,
	organizationId: string,
	period: BillingPeriod
): Promise<MicroUsd> {
	const [row] = await manager.execute<{ total: string }[]>(
		`SELECT COALESCE(SUM(charge."amountMicroUsd"), 0)::text AS total
		 FROM private_pool_charge charge
		 WHERE charge."organizationId" = ?
		   AND charge."serviceDay" >= ? AND charge."serviceDay" < ?`,
		[organizationId, period.start, period.end]
	);
	return row ? MicroUsd.parse(row.total) : MicroUsd.ZERO;
}
