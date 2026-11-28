/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { BYTES_PER_GIGABYTE } from '../../../billing/constants/billing.constants';
import { formatStatementMonth } from '../../../billing/utils/reporting/billing-statement.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { MachineListing } from '../../../marketplace/entities/machine-listing.entity';
import type { MachineTrafficReportDto } from '../../dto/machine-host-report.dto';

@Injectable()
export class MachineTrafficService {
	constructor(private readonly entityManager: EntityManager) {}

	async record(
		machineId: string,
		report: MachineTrafficReportDto
	): Promise<void> {
		await this.entityManager.fork().transactional(async (manager) => {
			const listing = await manager.findOne(
				MachineListing,
				{ machineId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!listing) return;
			if (
				listing.trafficMonth !== null &&
				report.month < listing.trafficMonth
			) {
				return;
			}
			const now = await databaseNow(manager);
			listing.trafficMonth = report.month;
			listing.trafficBytes = report.bytes;
			if (report.month !== formatStatementMonth(now)) return;
			const capReached =
				listing.monthlyTrafficCapGb !== null &&
				BigInt(report.bytes) >=
					BigInt(listing.monthlyTrafficCapGb) * BigInt(BYTES_PER_GIGABYTE);
			listing.trafficCapReachedAt = capReached
				? (listing.trafficCapReachedAt ?? now)
				: null;
		});
	}

	async resetMonthly(): Promise<void> {
		await this.entityManager.fork().execute(
			`UPDATE machine_listing SET "trafficCapReachedAt" = NULL
			 WHERE "trafficCapReachedAt" < date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`
		);
	}
}
