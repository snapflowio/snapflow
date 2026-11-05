/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { DockerRegistryModule } from '../docker-registry/docker-registry.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ControlWakeModule } from '../infra/control-wake/control-wake.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { RealtimeOutboxEvent } from '../notification/entities/realtime-outbox-event.entity';
import { OrganizationModule } from '../organization/organization.module';
import { SecretsModule } from '../secrets/secrets.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminSandboxController } from './controllers/admin-sandbox.controller';
import { MachineSandboxControlController } from './controllers/machine-sandbox-control.controller';
import { MachineSelfController } from './controllers/machine-self.controller';
import { MachineSnapshotControlController } from './controllers/machine-snapshot-control.controller';
import { SandboxController } from './controllers/sandbox.controller';
import { SandboxCaptureController } from './controllers/sandbox-capture.controller';
import { SandboxForkController } from './controllers/sandbox-fork.controller';
import { SandboxLifecycleController } from './controllers/sandbox-lifecycle.controller';
import { SandboxPlacementController } from './controllers/sandbox-placement.controller';
import { SandboxRuntimeController } from './controllers/sandbox-runtime.controller';
import { SandboxSettingsController } from './controllers/sandbox-settings.controller';
import { Sandbox } from './entities/sandbox.entity';
import { SandboxFork } from './entities/sandbox-fork.entity';
import { SandboxLastActivity } from './entities/sandbox-last-activity.entity';
import { SandboxObservedStatus } from './entities/sandbox-observed-status.entity';
import { SandboxPlacement } from './entities/sandbox-placement.entity';
import { SshAccess } from './entities/ssh-access.entity';
import { MachineModule } from './machine/machine.module';
import { MachineJobModule } from './machine-job/machine-job.module';
import { SandboxArchiveAction } from './managers/actions/sandbox-archive.action';
import { SandboxBuildAction } from './managers/actions/sandbox-build.action';
import { SandboxDestroyAction } from './managers/actions/sandbox-destroy.action';
import { SandboxRestoreAction } from './managers/actions/sandbox-restore.action';
import { SandboxStartAction } from './managers/actions/sandbox-start.action';
import { SandboxStopAction } from './managers/actions/sandbox-stop.action';
import { BackupManager } from './managers/backup/backup.manager';
import { BackupMaintenanceManager } from './managers/backup/backup-maintenance.manager';
import { VolumeBackupScheduleManager } from './managers/backup/volume-backup-schedule.manager';
import { DrainingMachineManager } from './managers/draining-machine/draining-machine.manager';
import { PinnedStartWaitManager } from './managers/pinned-start-wait.manager';
import { SandboxManager } from './managers/sandbox.manager';
import { SandboxBuildWakeListener } from './managers/sandbox-build-wake.listener';
import { SandboxCleanupManager } from './managers/sandbox-cleanup.manager';
import { SandboxForkSourceListener } from './managers/sandbox-fork-source.listener';
import { SandboxIdlePolicyManager } from './managers/sandbox-idle-policy.manager';
import { SandboxLeaseRenewalManager } from './managers/sandbox-lease-renewal.manager';
import { SandboxLifecycleCascadeListener } from './managers/sandbox-lifecycle-cascade.listener';
import { SandboxStateWakeListener } from './managers/sandbox-state-wake.listener';
import { SandboxSyncScheduler } from './managers/sandbox-sync-scheduler.manager';
import { PlacementModule } from './placement/placement.module';
import { SandboxRepository } from './repositories/sandbox.repository';
import { SandboxAdmissionService } from './services/admission/sandbox-admission.service';
import { SandboxQuoteService } from './services/admission/sandbox-quote.service';
import { UnobservedCreateReassignmentService } from './services/admission/unobserved-create-reassignment.service';
import { SandboxArtifactJobProjector } from './services/backup/sandbox-artifact-job.projector';
import { SandboxBackupExecutionService } from './services/backup/sandbox-backup-execution.service';
import { SandboxBackupRequestService } from './services/backup/sandbox-backup-request.service';
import { SandboxBackupStateService } from './services/backup/sandbox-backup-state.service';
import { DrainingMachineEvictionService } from './services/draining-machine/draining-machine-eviction.service';
import { DrainingMachineRecoveryService } from './services/draining-machine/draining-machine-recovery.service';
import { SandboxBuildCreateService } from './services/lifecycle/sandbox-build-create.service';
import { SandboxCaptureService } from './services/lifecycle/sandbox-capture.service';
import { SandboxCreateNotifier } from './services/lifecycle/sandbox-create-notifier.service';
import { SandboxForkService } from './services/lifecycle/sandbox-fork.service';
import { SandboxLifecycleService } from './services/lifecycle/sandbox-lifecycle.service';
import { SandboxRecoveryService } from './services/lifecycle/sandbox-recovery.service';
import { SandboxSnapshotCreateService } from './services/lifecycle/sandbox-snapshot-create.service';
import { SandboxService } from './services/sandbox/sandbox.service';
import { SandboxActivityService } from './services/sandbox/sandbox-activity.service';
import { SandboxFundingPolicyService } from './services/sandbox/sandbox-funding-policy.service';
import { SandboxObservedStatusProjector } from './services/sandbox/sandbox-observed-status.projector';
import { SandboxObservedStatusService } from './services/sandbox/sandbox-observed-status.service';
import { SandboxQuotaService } from './services/sandbox/sandbox-quota.service';
import { SandboxRuntimeOperationService } from './services/sandbox/sandbox-runtime-operation.service';
import { SandboxRuntimeSpecService } from './services/sandbox/sandbox-runtime-spec.service';
import { SandboxSearchService } from './services/sandbox/sandbox-search.service';
import { SandboxSettingsService } from './services/sandbox/sandbox-settings.service';
import { SandboxStateWaitService } from './services/sandbox/sandbox-state-wait.service';
import { SnapshotModule } from './snapshot/snapshot.module';
import { RealtimeOutboxSubscriber } from './subscribers/realtime-outbox.subscriber';
import { VolumeModule } from './volume/volume.module';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			RealtimeOutboxEvent,
			Sandbox,
			SandboxFork,
			SandboxLastActivity,
			SandboxObservedStatus,
			SandboxPlacement,
			SshAccess,
		]),
		AuthModule,
		BillingModule,
		ControlWakeModule,
		DockerRegistryModule,
		IdempotencyModule,
		MachineJobModule,
		OrganizationModule,
		PlacementModule,
		RedisConnectionModule,
		MachineModule,
		SecretsModule,
		SettingsModule,
		SnapshotModule,
		VolumeModule,
	],
	controllers: [
		SandboxController,
		SandboxPlacementController,
		SandboxLifecycleController,
		SandboxRuntimeController,
		SandboxSettingsController,
		SandboxCaptureController,
		SandboxForkController,
		MachineSelfController,
		MachineSandboxControlController,
		MachineSnapshotControlController,
		AdminSandboxController,
	],
	providers: [
		BackupMaintenanceManager,
		BackupManager,
		DrainingMachineEvictionService,
		DrainingMachineManager,
		DrainingMachineRecoveryService,
		PinnedStartWaitManager,
		RealtimeOutboxSubscriber,
		SandboxActivityService,
		SandboxAdmissionService,
		SandboxArchiveAction,
		SandboxArtifactJobProjector,
		SandboxBackupExecutionService,
		SandboxBackupRequestService,
		SandboxBackupStateService,
		SandboxBuildAction,
		SandboxBuildCreateService,
		SandboxBuildWakeListener,
		SandboxCaptureService,
		SandboxCleanupManager,
		SandboxCreateNotifier,
		SandboxDestroyAction,
		SandboxForkService,
		SandboxForkSourceListener,
		SandboxFundingPolicyService,
		SandboxIdlePolicyManager,
		SandboxLeaseRenewalManager,
		SandboxLifecycleCascadeListener,
		SandboxLifecycleService,
		SandboxManager,
		SandboxObservedStatusProjector,
		SandboxObservedStatusService,
		SandboxQuotaService,
		SandboxQuoteService,
		SandboxRecoveryService,
		SandboxRepository,
		SandboxRestoreAction,
		SandboxRuntimeOperationService,
		SandboxRuntimeSpecService,
		SandboxSearchService,
		SandboxService,
		SandboxSettingsService,
		SandboxSnapshotCreateService,
		SandboxStartAction,
		SandboxStateWaitService,
		SandboxStateWakeListener,
		SandboxStopAction,
		SandboxSyncScheduler,
		UnobservedCreateReassignmentService,
		VolumeBackupScheduleManager,
	],
	exports: [
		BackupMaintenanceManager,
		BackupManager,
		DrainingMachineManager,
		PinnedStartWaitManager,
		SandboxActivityService,
		SandboxCleanupManager,
		SandboxFundingPolicyService,
		SandboxIdlePolicyManager,
		SandboxLeaseRenewalManager,
		SandboxLifecycleService,
		SandboxRuntimeOperationService,
		SandboxService,
		SandboxSnapshotCreateService,
		SandboxSyncScheduler,
		UnobservedCreateReassignmentService,
		VolumeBackupScheduleManager,
	],
})
export class SandboxModule {}
