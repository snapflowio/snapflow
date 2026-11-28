/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { UnmetDemandDto } from '../dto/unmet-demand.dto';

const UNMET_DEMAND_SUMMARY_SQL = `SELECT demand."priceClass", demand.continent,
		count(*)::int AS requests,
		sum(demand.cpu)::float8 AS vcpus,
		sum(demand.gpu)::int AS gpus
	FROM unmet_demand demand
	WHERE demand."createdAt" > now() - (? * interval '1 day')
	GROUP BY demand."priceClass", demand.continent
	ORDER BY requests DESC, demand."priceClass", demand.continent
	LIMIT ?`;

const UNMET_PRICE_CLASS_SQL = `SELECT count(*)::int AS requests,
		coalesce(sum(CASE WHEN demand.gpu > 0 THEN demand.gpu ELSE demand.cpu END), 0)::float8 AS units
	FROM unmet_demand demand
	WHERE demand."createdAt" > now() - (? * interval '1 day') AND demand."priceClass" = ?`;

export function unmetDemandSummary(
	manager: EntityManager,
	days: number,
	limit: number
): Promise<UnmetDemandDto[]> {
	return manager.execute<UnmetDemandDto[]>(UNMET_DEMAND_SUMMARY_SQL, [
		days,
		limit,
	]);
}

export async function unmetPriceClassDemand(
	manager: EntityManager,
	priceClass: string,
	days: number
): Promise<{ requests: number; units: number }> {
	const [row] = await manager.execute<{ requests: number; units: number }[]>(
		UNMET_PRICE_CLASS_SQL,
		[days, priceClass]
	);
	return row ?? { requests: 0, units: 0 };
}
