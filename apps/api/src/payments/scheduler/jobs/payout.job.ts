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
import {
	PAYOUT_TIME_ZONE,
	PaymentsJob,
} from '../../funds/constants/payments.constants';
import { PayoutService } from '../../funds/services/payout.service';
import { runExclusivePaymentsJob } from '../utils/exclusive-payments-job.util';

@Injectable()
export class PayoutJob {
	constructor(
		private readonly payoutService: PayoutService,
		private readonly locks: RedisLockProvider
	) {}

	@ScheduledJob(CronExpression.EVERY_HOUR, {
		name: PaymentsJob.RUN_PAYOUTS,
		waitForCompletion: true,
		timeZone: PAYOUT_TIME_ZONE,
	})
	async runPayouts(): Promise<void> {
		await runExclusivePaymentsJob(this.locks, PaymentsJob.RUN_PAYOUTS, () =>
			this.payoutService.runPayouts()
		);
	}
}
