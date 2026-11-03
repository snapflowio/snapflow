/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { TypedConfigModule } from '../../config/typed-config.module';
import {
	THROTTLER_REDIS_CONNECTION,
	THROTTLER_REDIS_DATABASE,
} from './constants/redis.constants';
import { RedisLockProvider } from './providers/redis-lock.provider';

@Module({
	imports: [
		RedisModule.forRootAsync({
			imports: [TypedConfigModule],
			inject: [TypedConfigService],
			useFactory: (configService: TypedConfigService) => ({
				type: 'single',
				...configService.getRedisConnection(),
			}),
		}),
		RedisModule.forRootAsync(
			{
				imports: [TypedConfigModule],
				inject: [TypedConfigService],
				useFactory: (configService: TypedConfigService) => ({
					type: 'single',
					...configService.getRedisConnection({ db: THROTTLER_REDIS_DATABASE }),
				}),
			},
			THROTTLER_REDIS_CONNECTION
		),
	],
	providers: [RedisLockProvider],
	exports: [RedisLockProvider],
})
export class RedisConnectionModule {}
