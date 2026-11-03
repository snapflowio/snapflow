/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const REDIS_HEALTH_COMMAND_TIMEOUT_MS = 1000;

@Injectable()
export class RedisHealthIndicator {
	private readonly redis: Redis;
	constructor(
		@InjectRedis() redis: Redis,
		private readonly healthIndicatorService: HealthIndicatorService
	) {
		this.redis = redis.duplicate({
			commandTimeout: REDIS_HEALTH_COMMAND_TIMEOUT_MS,
		});
	}

	async isHealthy(key: string) {
		const indicator = this.healthIndicatorService.check(key);

		try {
			await this.redis.ping();
			return indicator.up();
		} catch {
			return indicator.down();
		}
	}
}
