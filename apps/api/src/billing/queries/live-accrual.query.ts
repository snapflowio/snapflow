/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type FilterQuery, QueryOrder } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';
import { usagePeriodCharge } from '../utils/usage-period-charge.util';
import { pricedPlacements } from './placement-price.query';

const USAGE_PERIOD_STREAM_CHUNK_SIZE = 100;

export async function liveAccrualByPlacement(
	manager: EntityManager,
	where: FilterQuery<SandboxUsagePeriod>,
	observedAt: Date
): Promise<Map<string, MicroUsd>> {
	const stream = manager.stream(SandboxUsagePeriod, {
		where,
		fields: [
			'placementId',
			'placementPriceId',
			'mode',
			'startAt',
			'cpu',
			'mem',
			'disk',
			'gpu',
		],
		orderBy: { id: QueryOrder.ASC },
		chunkSize: USAGE_PERIOD_STREAM_CHUNK_SIZE,
	});
	type StreamedPeriod =
		typeof stream extends AsyncIterable<infer Period> ? Period : never;
	const periods: StreamedPeriod[] = [];
	for await (const period of stream) periods.push(period);
	const terms = await pricedPlacements(
		manager,
		periods.map(({ placementPriceId }) => placementPriceId)
	);
	const byPlacement = new Map<string, MicroUsd>();
	for (const period of periods) {
		const recordedPriceTerms = terms.get(period.placementPriceId);
		if (!recordedPriceTerms) {
			throw new Error(
				`Usage period placement price ${period.placementPriceId} is missing`
			);
		}
		const charge = usagePeriodCharge(
			recordedPriceTerms,
			period,
			observedAt
		).grossMicroUsd;
		byPlacement.set(
			period.placementId,
			(byPlacement.get(period.placementId) ?? MicroUsd.ZERO).add(charge)
		);
	}
	return byPlacement;
}
