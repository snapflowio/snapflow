/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { BillingModule } from '../billing.module';
import { BillingUsageModule } from '../usage/usage.module';
import { BillingEvidenceRetentionJob } from './jobs/billing-evidence-retention.job';
import { UsageReconciliationJob } from './jobs/usage-reconciliation.job';

@Module({
	imports: [BillingModule, BillingUsageModule],
	providers: [BillingEvidenceRetentionJob, UsageReconciliationJob],
})
export class BillingSchedulerModule {}
