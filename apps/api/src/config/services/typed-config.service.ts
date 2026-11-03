/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { ConfigService, type Path, type PathValue } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';
import type { Configuration } from '../configuration.config';

@Injectable()
export class TypedConfigService {
	constructor(
		private readonly configService: ConfigService<Configuration, true>
	) {}

	get<K extends Path<Configuration>>(key: K): PathValue<Configuration, K> {
		return this.configService.get(key, { infer: true });
	}

	getOrThrow<K extends Path<Configuration>>(
		key: K
	): NonNullable<PathValue<Configuration, K>> {
		const value = this.get(key);
		if (value === null || value === undefined) {
			throw new Error(`Configuration key "${key}" is missing or undefined.`);
		}
		return value as NonNullable<PathValue<Configuration, K>>;
	}

	getRedisConnection(options: RedisOptions = {}): {
		url: string;
		options: RedisOptions;
	} {
		return { url: this.getOrThrow('redis.url'), options };
	}
}
