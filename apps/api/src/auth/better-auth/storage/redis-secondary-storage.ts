/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BetterAuthOptions } from 'better-auth';
import type Redis from 'ioredis';

type SecondaryStorage = NonNullable<BetterAuthOptions['secondaryStorage']>;

const SECONDARY_STORAGE_KEY_PREFIX = 'snapflow:auth:';
const REDIS_EXPIRY_SECONDS = 'EX';
const INCREMENT_KEY_COUNT = 1;
const INCREMENT_WITH_EXPIRY_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
	redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

export function createRedisSecondaryStorage(redis: Redis): SecondaryStorage {
	const redisKey = (key: string) => `${SECONDARY_STORAGE_KEY_PREFIX}${key}`;

	return {
		get: (key) => redis.get(redisKey(key)),
		getAndDelete: (key) => redis.getdel(redisKey(key)),
		async increment(key, ttl) {
			const count = await redis.eval(
				INCREMENT_WITH_EXPIRY_SCRIPT,
				INCREMENT_KEY_COUNT,
				redisKey(key),
				ttl
			);
			if (typeof count !== 'number') {
				throw new Error('Redis returned an invalid Better Auth counter');
			}
			return count;
		},
		set: (key, value, ttl) =>
			ttl
				? redis.set(redisKey(key), value, REDIS_EXPIRY_SECONDS, ttl)
				: redis.set(redisKey(key), value),
		async delete(key) {
			await redis.del(redisKey(key));
		},
	};
}
