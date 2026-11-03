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
import { EncryptionModule } from '../../infra/encryption/encryption.module';
import { ApiIdempotencyRecord } from './entities/api-idempotency-record.entity';
import { ApiIdempotentRequestService } from './services/api-idempotent-request.service';
import { IdempotencyPrunerService } from './services/idempotency-pruner.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([ApiIdempotencyRecord]),
		EncryptionModule,
	],
	providers: [ApiIdempotentRequestService, IdempotencyPrunerService],
	exports: [ApiIdempotentRequestService, IdempotencyPrunerService],
})
export class IdempotencyRequestModule {}
