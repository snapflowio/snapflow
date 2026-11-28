/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const THROTTLER_REDIS_CONNECTION = 'throttler';
export const THROTTLER_REDIS_DATABASE = 1;

export const REDIS_LOCK = {
	pollIntervalMilliseconds: 50,
	claimValue: '1',
	releaseOwnedScript: `
if redis.call("get", KEYS[1]) == ARGV[1] then
	return redis.call("del", KEYS[1])
end
return 0
`,
} as const;
