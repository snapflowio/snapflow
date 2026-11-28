/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { THROTTLER_REDIS_CONNECTION } from '../../redis/constants/redis.constants';
import {
	FAILED_AUTHENTICATION_KEY_PREFIX,
	RATE_LIMIT_POLICY,
} from '../constants/rate-limit-policy.constants';

const { limit, ttlSeconds } = RATE_LIMIT_POLICY.failedAuthentication;

@Injectable()
export class FailedAuthenticationLimiter {
	constructor(
		@InjectRedis(THROTTLER_REDIS_CONNECTION) private readonly redis: Redis
	) {}

	async guard<T>(request: Request, authenticate: () => Promise<T>): Promise<T> {
		const key = `${FAILED_AUTHENTICATION_KEY_PREFIX}${request.ip ?? ''}`;
		if (Number(await this.redis.get(key)) >= limit) {
			throw new ThrottlerException();
		}
		try {
			return await authenticate();
		} catch (error) {
			if (error instanceof UnauthorizedException) {
				await this.redis.multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
			}
			throw error;
		}
	}
}
