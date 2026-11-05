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
import { DockerRegistryModule } from '../docker-registry/docker-registry.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ControlWakeModule } from '../infra/control-wake/control-wake.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { MachineModule } from '../machine/machine.module';
import { MachineJobModule } from '../machine-job/machine-job.module';
import { ObjectStorageModule } from '../object-storage/object-storage.module';
import { OrganizationModule } from '../organization/organization.module';
import { PlacementModule } from '../placement/placement.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminSnapshotController } from './controllers/admin-snapshot.controller';
import { SnapshotController } from './controllers/snapshot.controller';
import { BuildInfo } from './entities/build-info.entity';
import { Snapshot } from './entities/snapshot.entity';
import { SnapshotMachine } from './entities/snapshot-machine.entity';
import { SnapshotLifecycleManager } from './managers/snapshot-lifecycle.manager';
import { SnapshotPropagationManager } from './managers/snapshot-propagation.manager';
import { SnapshotRetentionManager } from './managers/snapshot-retention.manager';
import { SnapshotRetirementManager } from './managers/snapshot-retirement.manager';
import { SnapshotRepository } from './repositories/snapshot.repository';
import { MachineSnapshotInventoryService } from './services/machine-snapshot-inventory.service';
import { SandboxSnapshotLookupService } from './services/sandbox-snapshot-lookup.service';
import { SnapshotService } from './services/snapshot.service';
import { SnapshotActivationService } from './services/snapshot-activation.service';
import { SnapshotBuildProgressService } from './services/snapshot-build-progress.service';
import { SnapshotBuildRegistrationService } from './services/snapshot-build-registration.service';
import { SnapshotCreationService } from './services/snapshot-creation.service';
import { SnapshotJobProjector } from './services/snapshot-job.projector';
import { SnapshotMachineSelectionService } from './services/snapshot-machine-selection.service';
import { SnapshotPrewarmService } from './services/snapshot-prewarm.service';
import { SnapshotPublicationService } from './services/snapshot-publication.service';
import { SnapshotQuotaService } from './services/snapshot-quota.service';
import { SnapshotStateService } from './services/snapshot-state.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([BuildInfo, Snapshot, SnapshotMachine]),
		ControlWakeModule,
		DockerRegistryModule,
		IdempotencyModule,
		MachineJobModule,
		ObjectStorageModule,
		OrganizationModule,
		PlacementModule,
		RedisConnectionModule,
		MachineModule,
		SettingsModule,
	],
	controllers: [SnapshotController, AdminSnapshotController],
	providers: [
		MachineSnapshotInventoryService,
		SandboxSnapshotLookupService,
		SnapshotActivationService,
		SnapshotBuildProgressService,
		SnapshotBuildRegistrationService,
		SnapshotCreationService,
		SnapshotJobProjector,
		SnapshotLifecycleManager,
		SnapshotPrewarmService,
		SnapshotPropagationManager,
		SnapshotPublicationService,
		SnapshotQuotaService,
		SnapshotRepository,
		SnapshotRetentionManager,
		SnapshotRetirementManager,
		SnapshotMachineSelectionService,
		SnapshotService,
		SnapshotStateService,
	],
	exports: [
		MachineSnapshotInventoryService,
		SandboxSnapshotLookupService,
		SnapshotBuildProgressService,
		SnapshotCreationService,
		SnapshotLifecycleManager,
		SnapshotPrewarmService,
		SnapshotPropagationManager,
		SnapshotQuotaService,
		SnapshotRepository,
		SnapshotRetentionManager,
		SnapshotRetirementManager,
		SnapshotService,
		SnapshotStateService,
	],
})
export class SnapshotModule {}
