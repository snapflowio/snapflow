/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Global, Module } from '@nestjs/common';
import { MachineModule } from '../machine/machine.module';
import { UsagePeriodFinalizer } from '../usage/services/usage-period-finalizer.service';
import { BillingModule } from './billing.module';
import { EarlySessionFailureService } from './services/usage/early-session-failure.service';
import { UsageBillingService } from './services/usage/usage-billing.service';
import { UsageReconciliationService } from './services/usage/usage-reconciliation.service';

@Global()
@Module({
	imports: [BillingModule, MachineModule],
	providers: [
		EarlySessionFailureService,
		UsageBillingService,
		UsageReconciliationService,
		{ provide: UsagePeriodFinalizer, useExisting: UsageBillingService },
	],
	exports: [
		EarlySessionFailureService,
		UsagePeriodFinalizer,
		UsageReconciliationService,
	],
})
export class BillingUsageModule {}
