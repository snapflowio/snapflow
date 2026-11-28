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
import {
	ThrottlerGuard,
	type ThrottlerModuleOptions,
	type ThrottlerRequest,
	type ThrottlerStorage,
} from '@nestjs/throttler';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import { MILLISECONDS_PER_SECOND } from '../constants/time.constants';
import {
	SESSION_RATE_LIMITED_KEY,
	THROTTLER_SCOPE_KEY,
} from '../decorators/throttler-scope.decorator';
import type { BaseAuthContext } from '../types/base-auth-context.types';
import { isEdgeAuthContext } from '../types/edge-auth-context.types';
import { isHealthCheckAuthContext } from '../types/health-check-auth-context.types';
import { isMachineAuthContext } from '../types/machine-auth-context.types';
import { isOrganizationAuthContext } from '../types/organization-auth-context.types';
import {
	type OrganizationRateLimits,
	readOrganizationRateLimits,
} from '../utils/organization-rate-limits.util';

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
export class RateLimitGuard extends ThrottlerGuard {
	constructor(
		options: ThrottlerModuleOptions,
		storageService: ThrottlerStorage,
		reflector: Reflector,
		private readonly entityManager: EntityManager,
		@InjectRedis() private readonly redis: Redis
	) {
		super(options, storageService, reflector);
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const { user } = context.switchToHttp().getRequest<Request>();
		const awaitsSession = this.reflector.getAllAndOverride<boolean>(
			SESSION_RATE_LIMITED_KEY,
			[context.getHandler(), context.getClass()]
		);
		if (awaitsSession && !user) return true;
		return super.canActivate(context);
	}

	protected generateKey(
		// biome-ignore lint/correctness/noUnusedFunctionParameters: ThrottlerGuard fixes this signature and the bucket is shared by every route
		context: ExecutionContext,
		tracker: string,
		throttlerName: string
	): string {
		return `${throttlerName}-${tracker}`;
	}

	protected async getTracker(request: Request): Promise<string> {
		return (
			authenticatedTracker(request.user) ?? `anonymous:${request.ip ?? ''}`
		);
	}

	async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
		const { context, throttler } = requestProps;
		const { user } = context.switchToHttp().getRequest<Request>();
		if (!this.appliesTo(context, throttler.name, user)) return true;
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
		throttlerName: string | undefined,
		user: BaseAuthContext | undefined
	): boolean {
		if (throttlerName === RateLimitThrottler.AUTHENTICATED) return !!user;
		if (throttlerName === RateLimitThrottler.ANONYMOUS) return !user;
		const scopes = this.reflector.getAllAndOverride<
			readonly string[] | undefined
		>(THROTTLER_SCOPE_KEY, [context.getHandler(), context.getClass()]);
		return throttlerName !== undefined && !!scopes?.includes(throttlerName);
	}
}

function authenticatedTracker(user: unknown): string | null {
	if (isOrganizationAuthContext(user)) {
		return `auth:organization:${user.organizationId}`;
	}
	if (isMachineAuthContext(user)) return `auth:machine:${user.machineId}`;
	if (isEdgeAuthContext(user)) return `auth:edge:${user.edgeId}`;
	if (isHealthCheckAuthContext(user)) return `auth:${user.role}`;
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
