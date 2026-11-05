/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Global, Module } from '@nestjs/common';
import { UsagePeriodFinalizer } from '../usage/services/usage-period-finalizer.service';
import { BillingModule } from './billing.module';
import { UsageBillingService } from './services/usage-billing.service';
import { UsageReconciliationService } from './services/usage-reconciliation.service';

@Global()
@Module({
	imports: [BillingModule],
	providers: [
		UsageBillingService,
		UsageReconciliationService,
		{ provide: UsagePeriodFinalizer, useExisting: UsageBillingService },
	],
	exports: [UsagePeriodFinalizer, UsageReconciliationService],
})
export class BillingUsageModule {}
