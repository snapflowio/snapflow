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
import { millisecondsBetween } from '../../common/utils/time.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { priceUsage } from '../../marketplace/utils/pricing.util';
import { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';
import {
	allocationUnits,
	intendedQuantities,
} from '../../usage/utils/usage-quantities.util';
import { pricedLeases } from './lease-price.query';

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
			'leaseId',
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
	const periods = [];
	for await (const period of stream) periods.push(period);
	const terms = await pricedLeases(
		manager,
		periods.map(({ leaseId }) => leaseId)
	);
	const byPlacement = new Map<string, MicroUsd>();
	for (const period of periods) {
		const leaseTerms = terms.get(period.leaseId);
		if (!leaseTerms) {
			throw new Error(`Usage period lease ${period.leaseId} is missing`);
		}
		const elapsed = BigInt(
			Math.max(0, millisecondsBetween(period.startAt, observedAt))
		);
		const charge = priceUsage(
			leaseTerms,
			intendedQuantities(
				{
					cpu: allocationUnits(period.cpu, 'CPU'),
					memoryGiB: allocationUnits(period.mem, 'memory'),
					diskGiB: allocationUnits(period.disk, 'disk'),
					gpu: allocationUnits(period.gpu, 'GPU'),
				},
				period.mode,
				elapsed
			)
		).grossMicroUsd;
		byPlacement.set(
			period.placementId,
			(byPlacement.get(period.placementId) ?? MicroUsd.ZERO).add(charge)
		);
	}
	return byPlacement;
}
