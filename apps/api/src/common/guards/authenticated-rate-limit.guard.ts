/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type {
	ThrottlerModuleOptions,
	ThrottlerRequest,
	ThrottlerStorage,
} from '@nestjs/throttler';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import { MILLISECONDS_PER_SECOND } from '../constants/time.constants';
import { THROTTLER_SCOPE_KEY } from '../decorators/throttler-scope.decorator';
import { InvalidAuthenticationContextException } from '../exceptions/invalid-authentication-context.exception';
import { isMachineAuthContext } from '../types/machine-auth-context.types';
import { isOrganizationAuthContext } from '../types/organization-auth-context.types';
import {
	type OrganizationRateLimits,
	readOrganizationRateLimits,
} from '../utils/organization-rate-limits.util';
import { SharedBucketThrottlerGuard } from './shared-bucket-throttler.guard';

const SCOPED_THROTTLERS: ReadonlySet<string> = new Set([
	RateLimitThrottler.SANDBOX_CREATE,
	RateLimitThrottler.SANDBOX_LIFECYCLE,
	RateLimitThrottler.MACHINE_REGISTER,
]);

const ORGANIZATION_THROTTLER_OVERRIDES: Partial<
	Record<
		string,
		{
			limit: keyof OrganizationRateLimits;
			ttlSeconds: keyof OrganizationRateLimits;
		}
	>
> = {
	[RateLimitThrottler.AUTHENTICATED]: {
		limit: 'authenticatedRateLimit',
		ttlSeconds: 'authenticatedRateLimitTtlSeconds',
	},
	[RateLimitThrottler.SANDBOX_CREATE]: {
		limit: 'sandboxCreateRateLimit',
		ttlSeconds: 'sandboxCreateRateLimitTtlSeconds',
	},
	[RateLimitThrottler.SANDBOX_LIFECYCLE]: {
		limit: 'sandboxLifecycleRateLimit',
		ttlSeconds: 'sandboxLifecycleRateLimitTtlSeconds',
	},
};

@Injectable()
export class AuthenticatedRateLimitGuard extends SharedBucketThrottlerGuard {
	constructor(
		options: ThrottlerModuleOptions,
		storageService: ThrottlerStorage,
		reflector: Reflector,
		private readonly entityManager: EntityManager,
		@InjectRedis() private readonly redis: Redis
	) {
		super(options, storageService, reflector);
	}

	protected async getTracker(req: Request): Promise<string> {
		const tracker = rateLimitTracker(req.user);
		if (!tracker) throw new InvalidAuthenticationContextException();
		return tracker;
	}

	async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
		const { context, throttler } = requestProps;
		const { user } = context.switchToHttp().getRequest<Request>();
		if (!rateLimitTracker(user) || !this.appliesTo(context, throttler.name)) {
			return true;
		}
		if (!isOrganizationAuthContext(user)) {
			return super.handleRequest(requestProps);
		}
		return super.handleRequest(
			withOrganizationOverrides(
				requestProps,
				await readOrganizationRateLimits(
					this.entityManager,
					this.redis,
					user.organizationId
				)
			)
		);
	}

	private appliesTo(
		context: ExecutionContext,
		throttlerName: string | undefined
	): boolean {
		if (throttlerName === RateLimitThrottler.AUTHENTICATED) return true;
		if (throttlerName === undefined || !SCOPED_THROTTLERS.has(throttlerName)) {
			return false;
		}
		const scopes = this.reflector.getAllAndOverride<
			readonly string[] | undefined
		>(THROTTLER_SCOPE_KEY, [context.getHandler(), context.getClass()]);
		return scopes?.includes(throttlerName) === true;
	}
}

function rateLimitTracker(user: unknown): string | null {
	if (isOrganizationAuthContext(user)) {
		return `auth:organization:${user.organizationId}`;
	}
	if (isMachineAuthContext(user)) {
		return `auth:machine:${user.machineId}`;
	}
	return null;
}

function withOrganizationOverrides(
	requestProps: ThrottlerRequest,
	limits: OrganizationRateLimits
): ThrottlerRequest {
	const override =
		ORGANIZATION_THROTTLER_OVERRIDES[requestProps.throttler.name ?? ''];
	if (!override) return requestProps;
	const limit = limits[override.limit];
	const ttlSeconds = limits[override.ttlSeconds];
	return {
		...requestProps,
		...(limit !== null && { limit }),
		...(ttlSeconds !== null && {
			ttl: ttlSeconds * MILLISECONDS_PER_SECOND,
			blockDuration: ttlSeconds * MILLISECONDS_PER_SECOND,
		}),
	};
}
