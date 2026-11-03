/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const RateLimitThrottler = {
	ANONYMOUS: 'anonymous',
	FAILED_AUTH: 'failed-auth',
	AUTHENTICATED: 'authenticated',
	SANDBOX_CREATE: 'sandbox-create',
	SANDBOX_LIFECYCLE: 'sandbox-lifecycle',
	MACHINE_REGISTER: 'machine-register',
} as const;

export type RateLimitThrottler =
	(typeof RateLimitThrottler)[keyof typeof RateLimitThrottler];

export const RATE_LIMIT_POLICY = {
	version: 1,
	throttlers: {
		[RateLimitThrottler.ANONYMOUS]: { ttlSeconds: 60, limit: 120 },
		[RateLimitThrottler.FAILED_AUTH]: { ttlSeconds: 60, limit: 20 },
		[RateLimitThrottler.AUTHENTICATED]: { ttlSeconds: 60, limit: 600 },
		[RateLimitThrottler.SANDBOX_CREATE]: { ttlSeconds: 60, limit: 30 },
		[RateLimitThrottler.SANDBOX_LIFECYCLE]: { ttlSeconds: 60, limit: 120 },
		[RateLimitThrottler.MACHINE_REGISTER]: { ttlSeconds: 60, limit: 10 },
	},
} as const satisfies {
	version: number;
	throttlers: Record<RateLimitThrottler, { ttlSeconds: number; limit: number }>;
};
