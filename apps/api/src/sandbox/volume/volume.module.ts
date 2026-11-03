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
import { IdempotencyRequestModule } from '../../idempotency/request/request.module';
import { EncryptionModule } from '../../infra/encryption/encryption.module';
import { RedisConnectionModule } from '../../infra/redis/redis.module';
import { ObjectStorageModule } from '../../object-storage/object-storage.module';
import { OrganizationTenantModule } from '../../organization/tenant/tenant.module';
import { MachineJobModule } from '../machine-job/machine-job.module';
import { PlacementModule } from '../placement/placement.module';
import { VolumeController } from './controllers/volume.controller';
import { Volume } from './entities/volume.entity';
import { VolumeBackup } from './entities/volume-backup.entity';
import { VolumeManager } from './managers/volume.manager';
import { VolumeBackupRetentionManager } from './managers/volume-backup-retention.manager';
import { VolumeLastUsedListener } from './managers/volume-last-used.listener';
import { VolumeService } from './services/volume.service';
import { VolumeAttachmentService } from './services/volume-attachment.service';
import { VolumeBackupService } from './services/volume-backup.service';
import { VolumeBackupDataKeyService } from './services/volume-backup-data-key.service';
import { VolumeJobProjector } from './services/volume-job.projector';
import { VolumeOperationService } from './services/volume-operation.service';
import { VolumeProvisioningService } from './services/volume-provisioning.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([Volume, VolumeBackup]),
		EncryptionModule,
		IdempotencyRequestModule,
		MachineJobModule,
		ObjectStorageModule,
		OrganizationTenantModule,
		PlacementModule,
		RedisConnectionModule,
	],
	controllers: [VolumeController],
	providers: [
		VolumeAttachmentService,
		VolumeBackupDataKeyService,
		VolumeBackupRetentionManager,
		VolumeBackupService,
		VolumeJobProjector,
		VolumeLastUsedListener,
		VolumeManager,
		VolumeOperationService,
		VolumeProvisioningService,
		VolumeService,
	],
	exports: [
		VolumeAttachmentService,
		VolumeBackupRetentionManager,
		VolumeBackupService,
		VolumeManager,
		VolumeService,
	],
})
export class VolumeModule {}
