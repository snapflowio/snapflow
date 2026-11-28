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
	AUTHENTICATED: 'authenticated',
	SANDBOX_CREATE: 'sandbox-create',
	SANDBOX_LIFECYCLE: 'sandbox-lifecycle',
	MACHINE_REGISTER: 'machine-register',
	CREDENTIALS: 'credentials',
	WEBHOOKS: 'webhooks',
	CHAIN_RPC: 'chain-rpc',
	BILLING_DOCUMENTS: 'billing-documents',
	ABUSE_REPORTS: 'abuse-reports',
	OBJECT_STORAGE_UPLOADS: 'object-storage-uploads',
} as const;

export type RateLimitThrottler =
	(typeof RateLimitThrottler)[keyof typeof RateLimitThrottler];

export const RATE_LIMIT_POLICY = {
	throttlers: {
		[RateLimitThrottler.ANONYMOUS]: { ttlSeconds: 60, limit: 120 },
		[RateLimitThrottler.AUTHENTICATED]: { ttlSeconds: 60, limit: 600 },
		[RateLimitThrottler.SANDBOX_CREATE]: { ttlSeconds: 60, limit: 30 },
		[RateLimitThrottler.SANDBOX_LIFECYCLE]: { ttlSeconds: 60, limit: 120 },
		[RateLimitThrottler.MACHINE_REGISTER]: { ttlSeconds: 60, limit: 10 },
		[RateLimitThrottler.CREDENTIALS]: { ttlSeconds: 60, limit: 60 },
		[RateLimitThrottler.WEBHOOKS]: { ttlSeconds: 60, limit: 60 },
		[RateLimitThrottler.CHAIN_RPC]: { ttlSeconds: 60, limit: 300 },
		[RateLimitThrottler.BILLING_DOCUMENTS]: { ttlSeconds: 60, limit: 30 },
		[RateLimitThrottler.ABUSE_REPORTS]: { ttlSeconds: 3_600, limit: 10 },
		[RateLimitThrottler.OBJECT_STORAGE_UPLOADS]: { ttlSeconds: 60, limit: 30 },
	},
	failedAuthentication: { ttlSeconds: 60, limit: 30 },
} as const satisfies {
	throttlers: Record<RateLimitThrottler, { ttlSeconds: number; limit: number }>;
	failedAuthentication: { ttlSeconds: number; limit: number };
};

export const FAILED_AUTHENTICATION_KEY_PREFIX = 'failed-authentication:';
