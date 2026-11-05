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
import { StripeReconciliationService } from '../../services/stripe-reconciliation.service';
import { runExclusivePaymentsJob } from '../utils/exclusive-payments-job.util';

@Injectable()
export class StripeReconciliationJob {
	constructor(
		private readonly stripeReconciliationService: StripeReconciliationService,
		private readonly locks: RedisLockProvider
	) {}

	@ScheduledJob(CronExpression.EVERY_DAY_AT_3AM, {
		name: PaymentsJob.RECONCILE_STRIPE,
		waitForCompletion: true,
	})
	async reconcileDaily(): Promise<void> {
		await runExclusivePaymentsJob(
			this.locks,
			PaymentsJob.RECONCILE_STRIPE,
			() => this.stripeReconciliationService.reconcileDaily()
		);
	}
}
