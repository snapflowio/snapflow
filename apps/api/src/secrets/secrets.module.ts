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
import { EncryptionModule } from '../infra/encryption/encryption.module';
import { SecretController } from './controllers/secret.controller';
import { SandboxSecretBinding } from './entities/sandbox-secret-binding.entity';
import { SandboxSecretBindingSet } from './entities/sandbox-secret-binding-set.entity';
import { Secret } from './entities/secret.entity';
import { SecretDeliveryEvent } from './entities/secret-delivery-event.entity';
import { SecretVersion } from './entities/secret-version.entity';
import { MachineSandboxSecretDeliveryService } from './services/machine-sandbox-secret-delivery.service';
import { SecretService } from './services/secret.service';
import { SecretResourceService } from './services/secret-resource.service';
import { SecretVersionCipherService } from './services/secret-version-cipher.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			Secret,
			SecretVersion,
			SandboxSecretBinding,
			SandboxSecretBindingSet,
			SecretDeliveryEvent,
		]),
		EncryptionModule,
		IdempotencyModule,
	],
	controllers: [SecretController],
	providers: [
		SecretService,
		SecretResourceService,
		SecretVersionCipherService,
		MachineSandboxSecretDeliveryService,
	],
	exports: [SecretService, MachineSandboxSecretDeliveryService],
})
export class SecretsModule {}
