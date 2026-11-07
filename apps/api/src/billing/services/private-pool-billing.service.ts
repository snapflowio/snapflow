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
import { MicroUsd } from '../../common/values/micro-usd.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import { PrivatePoolCharge } from '../entities/private-pool-charge.entity';
import { unchargedPrivatePoolMachines } from '../queries/private-pool.query';
import { privatePoolPosting } from '../utils/ledger/billing-private-pool-posting.util';
import { privatePoolDayFee, utcDayStart } from '../utils/private-pool-fee.util';
import { BillingLedgerService } from './billing-ledger.service';

// Charges every machine in a private pool for the current UTC day, once, at
// the monthly fee in force when the day is first charged, and posts each
// charge to the ledger in the same transaction.
@Injectable()
export class PrivatePoolBillingService {
	constructor(
		private readonly settings: SettingsService,
		private readonly ledger: BillingLedgerService
	) {}

	async chargeCurrentDay(manager: EntityManager): Promise<void> {
		const serviceDay = utcDayStart(await databaseNow(manager));
		const machines = await unchargedPrivatePoolMachines(manager, serviceDay);
		if (machines.length === 0) return;
		const { privatePoolMachineMonthlyMicroUsd } = await this.settings.get();
		const amount = privatePoolDayFee(
			MicroUsd.of(BigInt(privatePoolMachineMonthlyMicroUsd)),
			serviceDay
		);
		const charges = machines.map((machine) =>
			manager.create(PrivatePoolCharge, {
				...machine,
				serviceDay,
				amountMicroUsd: amount.toString(),
			})
		);
		await manager.flush();
		if (!amount.isPositive()) return;
		for (const charge of charges) {
			await this.ledger.post(manager, privatePoolPosting(charge));
		}
	}
}
