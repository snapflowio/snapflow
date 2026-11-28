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
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { OrganizationModule } from '../organization/organization.module';
import { AdminDockerRegistryController } from './controllers/admin-docker-registry.controller';
import { DockerRegistryController } from './controllers/docker-registry.controller';
import { RegistryTokenKeysController } from './controllers/registry-token-keys.controller';
import { DockerRegistryPersistenceModule } from './docker-registry-persistence.module';
import { DockerRegistry } from './entities/docker-registry.entity';
import { EcrCredentialsService } from './services/access/ecr-credentials.service';
import { RegistryTokenService } from './services/access/registry-token.service';
import { RegistryTokenSigner } from './services/access/registry-token-signer.service';
import { DockerRegistryService } from './services/docker-registry.service';
import { DockerRegistryImageCleanupService } from './services/docker-registry-image-cleanup.service';
import { DockerRegistryLookupService } from './services/docker-registry-lookup.service';
import { DockerRegistrySourceService } from './services/docker-registry-source.service';
import { SnapshotManagerRegistryService } from './services/snapshot-manager-registry.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([DockerRegistry]),
		DockerRegistryPersistenceModule,
		IdempotencyModule,
		OrganizationModule,
	],
	controllers: [
		DockerRegistryController,
		AdminDockerRegistryController,
		RegistryTokenKeysController,
	],
	providers: [
		DockerRegistryService,
		DockerRegistryImageCleanupService,
		DockerRegistryLookupService,
		DockerRegistrySourceService,
		EcrCredentialsService,
		RegistryTokenService,
		RegistryTokenSigner,
		SnapshotManagerRegistryService,
	],
	exports: [DockerRegistryService, RegistryTokenService],
})
export class DockerRegistryModule {}
