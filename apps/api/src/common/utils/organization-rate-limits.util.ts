/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import {
	ORGANIZATION_RATE_LIMITS_CACHE,
	organizationRateLimitsCacheKey,
} from '../../organization/constants/organization-limits.constants';
import { OrganizationLimits } from '../../organization/entities/organization-limits.entity';

const ORGANIZATION_RATE_LIMIT_FIELDS = [
	'authenticatedRateLimit',
	'sandboxCreateRateLimit',
	'sandboxLifecycleRateLimit',
	'authenticatedRateLimitTtlSeconds',
	'sandboxCreateRateLimitTtlSeconds',
	'sandboxLifecycleRateLimitTtlSeconds',
] as const;

export type OrganizationRateLimits = Pick<
	OrganizationLimits,
	(typeof ORGANIZATION_RATE_LIMIT_FIELDS)[number]
>;

const RATE_LIMIT_OVERRIDE = z.number().int().nullable();

const CACHED_ORGANIZATION_RATE_LIMITS = z.object({
	authenticatedRateLimit: RATE_LIMIT_OVERRIDE,
	sandboxCreateRateLimit: RATE_LIMIT_OVERRIDE,
	sandboxLifecycleRateLimit: RATE_LIMIT_OVERRIDE,
	authenticatedRateLimitTtlSeconds: RATE_LIMIT_OVERRIDE,
	sandboxCreateRateLimitTtlSeconds: RATE_LIMIT_OVERRIDE,
	sandboxLifecycleRateLimitTtlSeconds: RATE_LIMIT_OVERRIDE,
}) satisfies z.ZodType<OrganizationRateLimits>;

const NO_OVERRIDES: OrganizationRateLimits = {
	authenticatedRateLimit: null,
	sandboxCreateRateLimit: null,
	sandboxLifecycleRateLimit: null,
	authenticatedRateLimitTtlSeconds: null,
	sandboxCreateRateLimitTtlSeconds: null,
	sandboxLifecycleRateLimitTtlSeconds: null,
};

export async function readOrganizationRateLimits(
	entityManager: EntityManager,
	redis: Redis,
	organizationId: string
): Promise<OrganizationRateLimits> {
	const cacheKey = organizationRateLimitsCacheKey(organizationId);
	const cached = await redis.get(cacheKey);
	if (cached) return CACHED_ORGANIZATION_RATE_LIMITS.parse(JSON.parse(cached));

	const stored = await entityManager.findOne(
		OrganizationLimits,
		{ organizationId },
		{ fields: [...ORGANIZATION_RATE_LIMIT_FIELDS] }
	);
	const limits: OrganizationRateLimits = stored
		? {
				authenticatedRateLimit: stored.authenticatedRateLimit,
				sandboxCreateRateLimit: stored.sandboxCreateRateLimit,
				sandboxLifecycleRateLimit: stored.sandboxLifecycleRateLimit,
				authenticatedRateLimitTtlSeconds:
					stored.authenticatedRateLimitTtlSeconds,
				sandboxCreateRateLimitTtlSeconds:
					stored.sandboxCreateRateLimitTtlSeconds,
				sandboxLifecycleRateLimitTtlSeconds:
					stored.sandboxLifecycleRateLimitTtlSeconds,
			}
		: NO_OVERRIDES;
	await redis.set(
		cacheKey,
		JSON.stringify(limits),
		'EX',
		ORGANIZATION_RATE_LIMITS_CACHE.ttlSeconds
	);
	return limits;
}
