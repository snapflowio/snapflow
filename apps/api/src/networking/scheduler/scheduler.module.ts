/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { NetworkingCustomDomainModule } from '../custom-domain/custom-domain.module';
import { NetworkingModule } from '../networking.module';
import { NetworkingUsageModule } from '../usage/usage.module';
import { ControlSnapshotRefreshJob } from './jobs/control-snapshot-refresh.job';
import { CustomDomainReconcilerJob } from './jobs/custom-domain-reconciler.job';
import { ExposureDnsReconcilerJob } from './jobs/exposure-dns-reconciler.job';
import { ExposureReconciliationWorkerJob } from './jobs/exposure-reconciliation-worker.job';
import { NetworkBudgetJob } from './jobs/network-budget.job';
import { NetworkUsageRatingJob } from './jobs/network-usage-rating.job';
import { SystemExposureLeaseJob } from './jobs/system-exposure-lease.job';
import { SystemExposureProvisionerJob } from './jobs/system-exposure-provisioner.job';

@Module({
	imports: [
		NetworkingCustomDomainModule,
		NetworkingModule,
		NetworkingUsageModule,
	],
	providers: [
		ControlSnapshotRefreshJob,
		CustomDomainReconcilerJob,
		ExposureDnsReconcilerJob,
		ExposureReconciliationWorkerJob,
		NetworkUsageRatingJob,
		NetworkBudgetJob,
		SystemExposureLeaseJob,
		SystemExposureProvisionerJob,
	],
})
export class NetworkingSchedulerModule {}
