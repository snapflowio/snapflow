/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { MachineModule } from '../../machine/machine.module';
import { MachineJobModule } from '../../machine-job/machine-job.module';
import { OrganizationModule } from '../../organization/organization.module';
import { PlacementModule } from '../../placement/placement.module';
import { SettingsModule } from '../../settings/settings.module';
import { DefaultSnapshotBootstrapService } from '../../snapshot/services/default-snapshot-bootstrap.service';
import { SnapshotModule } from '../../snapshot/snapshot.module';
import { UserModule } from '../../user/user.module';
import { VolumeModule } from '../../volume/volume.module';
import { SandboxModule } from '../sandbox.module';
import { BackupJob } from './jobs/backup/backup.job';
import { BackupMaintenanceJob } from './jobs/backup/backup-maintenance.job';
import { DrainingMachineJob } from './jobs/machine/draining-machine.job';
import { MachineDecommissionJob } from './jobs/machine/machine-decommission.job';
import { MachineHealthJob } from './jobs/machine/machine-health.job';
import { MachineReassessmentJob } from './jobs/machine/machine-reassessment.job';
import { MachineReliabilityRetentionJob } from './jobs/machine/machine-reliability-retention.job';
import { MachineTrafficResetJob } from './jobs/machine/machine-traffic-reset.job';
import { JobLeaseExpiryJob } from './jobs/machine-job/job-lease-expiry.job';
import { JobProjectionJob } from './jobs/machine-job/job-projection.job';
import { SandboxActivityJob } from './jobs/sandbox-activity.job';
import { SandboxCleanupJob } from './jobs/sandbox-cleanup.job';
import { SandboxFundingPolicyJob } from './jobs/sandbox-funding-policy.job';
import { SandboxIdlePolicyJob } from './jobs/sandbox-idle-policy.job';
import { SandboxPriceChangeJob } from './jobs/sandbox-price-change.job';
import { SandboxStartWaitJob } from './jobs/sandbox-start-wait.job';
import { SandboxSyncSchedulerJob } from './jobs/sandbox-sync-scheduler.job';
import { SnapshotLifecycleJob } from './jobs/snapshot/snapshot-lifecycle.job';
import { SnapshotPropagationJob } from './jobs/snapshot/snapshot-propagation.job';
import { SnapshotRetentionJob } from './jobs/snapshot/snapshot-retention.job';
import { SnapshotRetirementJob } from './jobs/snapshot/snapshot-retirement.job';
import { UnobservedCreateReassignmentJob } from './jobs/unobserved-create-reassignment.job';
import { VolumeJob } from './jobs/volume/volume.job';
import { VolumeBackupJob } from './jobs/volume/volume-backup.job';

@Module({
	imports: [
		MachineModule,
		MachineJobModule,
		PlacementModule,
		SnapshotModule,
		VolumeModule,
		SandboxModule,
		OrganizationModule,
		SettingsModule,
		UserModule,
	],
	providers: [
		BackupMaintenanceJob,
		BackupJob,
		DrainingMachineJob,
		JobLeaseExpiryJob,
		SandboxCleanupJob,
		SandboxIdlePolicyJob,
		SandboxPriceChangeJob,
		SandboxStartWaitJob,
		SandboxSyncSchedulerJob,
		SnapshotLifecycleJob,
		SnapshotPropagationJob,
		SnapshotRetentionJob,
		SnapshotRetirementJob,
		VolumeJob,
		VolumeBackupJob,
		JobProjectionJob,
		MachineDecommissionJob,
		MachineHealthJob,
		MachineReassessmentJob,
		MachineReliabilityRetentionJob,
		MachineTrafficResetJob,
		SandboxActivityJob,
		SandboxFundingPolicyJob,
		UnobservedCreateReassignmentJob,
		DefaultSnapshotBootstrapService,
	],
	exports: [DefaultSnapshotBootstrapService],
})
export class SandboxSchedulerModule {}
