/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { addDays } from '../../../common/utils/time.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { BILLING_POLICY } from '../constants/billing-policy.constants';
import type { BillingBudget } from '../entities/billing-budget.entity';
import { recentNetworkUsage } from '../queries/billing-admission.query';
import { networkRunwayReservationMicroUsd } from '../utils/ledger/billing-reservation.util';

@Injectable()
export class BillingRunwayService {
	minimumRunwayMinutes(
		budget: Pick<BillingBudget, 'desiredMinimumRunwayMinutes'> | null
	): bigint {
		return BigInt(
			budget?.desiredMinimumRunwayMinutes ?? BILLING_POLICY.minimumRunwayMinutes
		);
	}

	async networkReservation(
		manager: EntityManager,
		organizationId: string,
		runwayMinutes: bigint,
		observedAt: Date
	): Promise<MicroUsd> {
		const historyStartedAt = addDays(
			observedAt,
			-BILLING_POLICY.networkReserveHistoryDays
		);
		return networkRunwayReservationMicroUsd({
			recentUsage: await recentNetworkUsage(
				manager,
				organizationId,
				historyStartedAt
			),
			observedAt,
			runwayMinutes,
			minimumMicroUsd: MicroUsd.parse(
				BILLING_POLICY.networkReserveMinimumMicroUsd
			),
		});
	}
}
