/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RedisModule } from '@nestjs-modules/ioredis';
import { HealthController } from './controllers/health.controller';
import { RedisHealthIndicator } from './services/redis-health.service';

@Module({
	imports: [TerminusModule, RedisModule],
	controllers: [HealthController],
	providers: [RedisHealthIndicator],
})
export class HealthModule {}
