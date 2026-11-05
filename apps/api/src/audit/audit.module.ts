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
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { AuditController } from './controllers/audit.controller';
import { AuditLog } from './entities/audit-log.entity';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditService } from './services/audit.service';

@Module({
	imports: [MikroOrmModule.forFeature([AuditLog]), RedisConnectionModule],
	controllers: [AuditController, AdminAuditController],
	providers: [AuditService, AuditInterceptor],
	exports: [AuditService],
})
export class AuditModule {}
