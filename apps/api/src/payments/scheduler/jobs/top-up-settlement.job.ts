/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { PaymentsJob } from '../../constants/payments.constants';
import { TopUpSettlementService } from '../../services/top-up-settlement.service';
import { runExclusivePaymentsJob } from '../utils/exclusive-payments-job.util';

@Injectable()
export class TopUpSettlementJob {
	constructor(
		private readonly topUpSettlement: TopUpSettlementService,
		private readonly locks: RedisLockProvider
	) {}

	@ScheduledJob(CronExpression.EVERY_5_MINUTES, {
		name: PaymentsJob.SETTLE_TOP_UPS,
		waitForCompletion: true,
	})
	async settleStale(): Promise<void> {
		await runExclusivePaymentsJob(this.locks, PaymentsJob.SETTLE_TOP_UPS, () =>
			this.topUpSettlement.settleStale()
		);
	}
}
