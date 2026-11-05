/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { parseDatabaseTimestamp } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import { EGRESS_PRICE_CLASS } from '../constants/pricing.constants';
import { MachineListing } from '../entities/machine-listing.entity';
import { MarketReferencePrice } from '../entities/market-reference-price.entity';
import type { PricedMachineRow } from '../queries/market-reference-price.query';
import {
	type EgressCeiling,
	type EgressCeilingPolicy,
	egressCeiling,
	nextAboveEgressCeilingSince,
} from '../utils/egress-ceiling.util';
import { marketMedians } from '../utils/price-floor.util';

@Injectable()
export class EgressCeilingService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService
	) {}

	async current(
		manager: EntityManager = this.entityManager
	): Promise<EgressCeiling> {
		const [market, policy] = await Promise.all([
			manager.findOne(MarketReferencePrice, { priceClass: EGRESS_PRICE_CLASS }),
			this.policy(),
		]);
		return egressCeiling(market, policy);
	}

	async recompute(
		manager: EntityManager,
		samples: readonly PricedMachineRow[],
		now: Date
	): Promise<EgressCeiling> {
		const market = marketMedians(
			samples.map((row) => ({
				priceClass: EGRESS_PRICE_CLASS,
				organizationId: row.organizationId,
				referencePriceMicroUsd: MicroUsd.parse(row.egressMicroUsdPerGiB),
			}))
		).get(EGRESS_PRICE_CLASS);
		const reference =
			(await manager.findOne(MarketReferencePrice, {
				priceClass: EGRESS_PRICE_CLASS,
			})) ??
			Object.assign(new MarketReferencePrice(), {
				priceClass: EGRESS_PRICE_CLASS,
			});
		reference.marketMedianMicroUsd = market?.medianMicroUsd.toString() ?? null;
		reference.sampleCount = market?.sampleCount ?? 0;
		reference.computedAt = now;
		manager.persist(reference);
		return egressCeiling(reference, await this.policy());
	}

	async flagAboveCeiling(
		manager: EntityManager,
		rows: readonly PricedMachineRow[],
		ceiling: EgressCeiling,
		now: Date
	): Promise<void> {
		const flagged: string[] = [];
		const cleared: string[] = [];
		for (const row of rows) {
			const current = row.aboveEgressCeilingSince
				? parseDatabaseTimestamp(row.aboveEgressCeilingSince)
				: null;
			const next = nextAboveEgressCeilingSince(
				MicroUsd.parse(row.egressMicroUsdPerGiB),
				ceiling,
				current,
				now
			);
			if (current === null && next !== null) flagged.push(row.machineId);
			if (current !== null && next === null) cleared.push(row.machineId);
		}
		if (flagged.length > 0) {
			await manager.nativeUpdate(
				MachineListing,
				{ machineId: { $in: flagged } },
				{ aboveEgressCeilingSince: now }
			);
		}
		if (cleared.length > 0) {
			await manager.nativeUpdate(
				MachineListing,
				{ machineId: { $in: cleared } },
				{ aboveEgressCeilingSince: null }
			);
		}
	}

	private async policy(): Promise<EgressCeilingPolicy> {
		const settings = await this.settings.get();
		return {
			maximumMicroUsdPerGiB: MicroUsd.of(
				BigInt(settings.egressPriceCeilingMicroUsdPerGiB)
			),
			medianBasisPoints: settings.egressCeilingMedianBasisPoints,
			minimumSamples: settings.priceFloorMinimumSamples,
		};
	}
}
