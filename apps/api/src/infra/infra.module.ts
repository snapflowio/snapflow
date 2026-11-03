/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypedConfigModule } from '../config/typed-config.module';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { LoggingModule } from './logging/logging.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { RedisConnectionModule } from './redis/redis.module';

const EVENT_EMITTER_MAX_LISTENERS = 100;

@Module({
	imports: [
		LoggingModule,
		TypedConfigModule.forRoot({
			isGlobal: true,
		}),
		DatabaseModule,
		RedisConnectionModule,
		RateLimitModule,
		EventEmitterModule.forRoot({
			maxListeners: EVENT_EMITTER_MAX_LISTENERS,
		}),
		EmailModule,
	],
})
export class InfraModule {}
