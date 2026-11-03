/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { THROTTLER_REDIS_CONNECTION } from '../redis/constants/redis.constants';
import { RedisConnectionModule } from '../redis/redis.module';
import { RATE_LIMIT_POLICY } from './constants/rate-limit-policy.constants';

@Module({
	imports: [
		ThrottlerModule.forRootAsync({
			imports: [RedisConnectionModule],
			useFactory: (redis: Redis) => ({
				throttlers: Object.entries(RATE_LIMIT_POLICY.throttlers).map(
					([name, { ttlSeconds, limit }]) => ({
						name,
						ttl: seconds(ttlSeconds),
						limit,
					})
				),
				storage: new ThrottlerStorageRedisService(redis),
			}),
			inject: [getRedisConnectionToken(THROTTLER_REDIS_CONNECTION)],
		}),
	],
})
export class RateLimitModule {}
