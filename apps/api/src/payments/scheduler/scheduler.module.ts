/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { ControlWakeModule } from '../../infra/control-wake/control-wake.module';
import { RedisConnectionModule } from '../../infra/redis/redis.module';
import { SettingsModule } from '../../settings/settings.module';
import { PaymentsModule } from '../payments.module';
import { AutoTopUpJob } from './jobs/auto-top-up.job';
import { EarningsMaturityJob } from './jobs/earnings-maturity.job';
import { PayoutJob } from './jobs/payout.job';
import { StripeEventProcessorJob } from './jobs/stripe-event-processor.job';
import { StripeReconciliationJob } from './jobs/stripe-reconciliation.job';
import { TopUpSettlementJob } from './jobs/top-up-settlement.job';

@Module({
	imports: [
		PaymentsModule,
		ControlWakeModule,
		RedisConnectionModule,
		SettingsModule,
	],
	providers: [
		AutoTopUpJob,
		EarningsMaturityJob,
		PayoutJob,
		StripeEventProcessorJob,
		StripeReconciliationJob,
		TopUpSettlementJob,
	],
})
export class PaymentsSchedulerModule {}
