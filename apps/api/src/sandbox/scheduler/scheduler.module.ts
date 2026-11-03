/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { OrganizationTenantModule } from '../../organization/tenant/tenant.module';
import { SettingsPlatformModule } from '../../settings/platform/platform.module';
import { UserModule } from '../../user/user.module';
import { SandboxInstanceModule } from '../instance/instance.module';
import { MachineModule } from '../machine/machine.module';
import { MachineJobModule } from '../machine-job/machine-job.module';
import { PlacementModule } from '../placement/placement.module';
import { DefaultSnapshotBootstrapService } from '../snapshot/services/default-snapshot-bootstrap.service';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { VolumeModule } from '../volume/volume.module';
import { BackupJob } from './jobs/backup.job';
import { BackupMaintenanceJob } from './jobs/backup-maintenance.job';
import { DrainingMachineJob } from './jobs/draining-machine.job';
import { JobLeaseExpiryJob } from './jobs/job-lease-expiry.job';
import { JobProjectionJob } from './jobs/job-projection.job';
import { MachineDecommissionJob } from './jobs/machine-decommission.job';
import { MachineHealthJob } from './jobs/machine-health.job';
import { MachineReassessmentJob } from './jobs/machine-reassessment.job';
import { MachineReliabilityRetentionJob } from './jobs/machine-reliability-retention.job';
import { PinnedStartWaitJob } from './jobs/pinned-start-wait.job';
import { SandboxActivityJob } from './jobs/sandbox-activity.job';
import { SandboxCleanupJob } from './jobs/sandbox-cleanup.job';
import { SandboxFundingPolicyJob } from './jobs/sandbox-funding-policy.job';
import { SandboxIdlePolicyJob } from './jobs/sandbox-idle-policy.job';
import { SandboxLeaseRenewalJob } from './jobs/sandbox-lease-renewal.job';
import { SandboxSyncSchedulerJob } from './jobs/sandbox-sync-scheduler.job';
import { SnapshotLifecycleJob } from './jobs/snapshot-lifecycle.job';
import { SnapshotPropagationJob } from './jobs/snapshot-propagation.job';
import { SnapshotRetentionJob } from './jobs/snapshot-retention.job';
import { SnapshotRetirementJob } from './jobs/snapshot-retirement.job';
import { UnobservedCreateReassignmentJob } from './jobs/unobserved-create-reassignment.job';
import { VolumeJob } from './jobs/volume.job';
import { VolumeBackupJob } from './jobs/volume-backup.job';

@Module({
	imports: [
		MachineModule,
		MachineJobModule,
		PlacementModule,
		SnapshotModule,
		VolumeModule,
		SandboxInstanceModule,
		OrganizationTenantModule,
		SettingsPlatformModule,
		UserModule,
	],
	providers: [
		BackupMaintenanceJob,
		BackupJob,
		DrainingMachineJob,
		JobLeaseExpiryJob,
		PinnedStartWaitJob,
		SandboxCleanupJob,
		SandboxIdlePolicyJob,
		SandboxLeaseRenewalJob,
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
		SandboxActivityJob,
		SandboxFundingPolicyJob,
		UnobservedCreateReassignmentJob,
		DefaultSnapshotBootstrapService,
	],
	exports: [DefaultSnapshotBootstrapService],
})
export class SandboxSchedulerModule {}
