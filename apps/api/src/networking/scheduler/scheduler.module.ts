/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { CloudflareModule } from '../../cloudflare/cloudflare.module';
import { CustomDomainModule } from '../../custom-domain/custom-domain.module';
import { NetworkUsageModule } from '../../network-usage/network-usage.module';
import { NetworkingModule } from '../networking.module';
import { CloudflareOriginPullJob } from './jobs/cloudflare-origin-pull.job';
import { ControlSnapshotRefreshJob } from './jobs/control-snapshot-refresh.job';
import { CustomDomainReconcilerJob } from './jobs/custom-domain-reconciler.job';
import { EdgeReachabilityJob } from './jobs/edge-reachability.job';
import { ExposureDnsReconcilerJob } from './jobs/exposure-dns-reconciler.job';
import { ExposureReconciliationWorkerJob } from './jobs/exposure-reconciliation-worker.job';
import { SystemExposureLeaseJob } from './jobs/system-exposure-lease.job';
import { SystemExposureProvisionerJob } from './jobs/system-exposure-provisioner.job';

@Module({
	imports: [
		CloudflareModule,
		CustomDomainModule,
		NetworkingModule,
		NetworkUsageModule,
	],
	providers: [
		CloudflareOriginPullJob,
		ControlSnapshotRefreshJob,
		CustomDomainReconcilerJob,
		EdgeReachabilityJob,
		ExposureDnsReconcilerJob,
		ExposureReconciliationWorkerJob,
		SystemExposureLeaseJob,
		SystemExposureProvisionerJob,
	],
})
export class NetworkingSchedulerModule {}
