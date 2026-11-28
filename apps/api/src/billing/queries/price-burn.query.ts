/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FilterQuery } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { PlacementPrice } from '../../marketplace/entities/placement-price.entity';
import {
	runningHourlyPrice,
	stoppedHourlyPrice,
} from '../../marketplace/utils/pricing/pricing.util';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { BILLING_HOLD } from '../../sandbox/values/sandbox-hold-policy.value';
import { priceShape } from '../utils/placement-pricing.util';
import { pricedPlacements } from './placement-price.query';

export interface SandboxBurn {
	sandboxId: string;
	running: boolean;
	hourlyMicroUsd: MicroUsd;
}

export function hourlyBurn(burns: readonly SandboxBurn[]): MicroUsd {
	return MicroUsd.sum(burns.map(({ hourlyMicroUsd }) => hourlyMicroUsd));
}

export async function sandboxBurn(
	manager: EntityManager,
	scope: FilterQuery<PlacementPrice>
): Promise<SandboxBurn[]> {
	const placementPrices = await manager.find(PlacementPrice, {
		$and: [scope, { endedAt: null }],
	});
	if (placementPrices.length === 0) return [];
	const terms = await pricedPlacements(
		manager,
		placementPrices.map(({ id }) => id)
	);
	const sandboxes = new Map(
		(
			await manager.find(
				Sandbox,
				{ id: { $in: placementPrices.map(({ sandboxId }) => sandboxId) } },
				{ fields: ['id', 'state', 'desiredState'] }
			)
		).map((sandbox) => [sandbox.id, sandbox])
	);
	return placementPrices.map((placementPrice) => {
		const recordedPriceTerms = terms.get(placementPrice.id);
		if (!recordedPriceTerms)
			throw new Error(
				`Placement price ${placementPrice.id} has no price terms`
			);
		const sandbox = sandboxes.get(placementPrice.sandboxId);
		const running = sandbox !== undefined && BILLING_HOLD.holdsCompute(sandbox);
		const shape = priceShape(placementPrice);
		return {
			sandboxId: placementPrice.sandboxId,
			running,
			hourlyMicroUsd: (running
				? runningHourlyPrice(recordedPriceTerms, shape)
				: stoppedHourlyPrice(recordedPriceTerms, shape)
			).grossMicroUsd,
		};
	});
}
