/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { earlyFailureCovers } from '../../billing/queries/early-session-failure.query';
import { EFFECTIVE_BILLING_LINE_AMOUNT_SQL } from '../../billing/utils/line-item/billing-line-query.util';
import { usagePeriodCharge } from '../../billing/utils/usage-period-charge.util';
import type { PlacementPrice } from '../../marketplace/entities/placement-price.entity';
import type {
	LinePrice,
	PriceTerms,
} from '../../marketplace/types/pricing.types';
import { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';
import type { PriceCharges } from '../types/payment-channel.types';

export async function priceCharges(
	manager: EntityManager,
	placementPrice: Pick<PlacementPrice, 'id' | 'sandboxId' | 'placementId'>,
	terms: PriceTerms,
	observedAt: Date
): Promise<PriceCharges> {
	const lines = await manager.execute<{ grossMicroUsd: string }[]>(
		`SELECT ${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}::text AS "grossMicroUsd"
		 FROM billing_line_item line
		 WHERE line."placementId" = ? AND line."placementPriceId" = ?`,
		[placementPrice.placementId, placementPrice.id]
	);
	const openPeriods = await manager.find(
		SandboxUsagePeriod,
		{
			sandboxId: placementPrice.sandboxId,
			placementPriceId: placementPrice.id,
			endAt: null,
		},
		{
			fields: [
				'sandboxId',
				'placementId',
				'assignmentGeneration',
				'mode',
				'startAt',
				'cpu',
				'mem',
				'disk',
				'gpu',
			],
		}
	);
	const accruals: LinePrice[] = [];
	for (const period of openPeriods) {
		if (await earlyFailureCovers(manager, period)) continue;
		accruals.push(usagePeriodCharge(terms, period, observedAt));
	}
	return { lines, accruals };
}
