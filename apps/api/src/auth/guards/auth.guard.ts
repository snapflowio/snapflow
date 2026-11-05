/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	CanActivate,
	ConflictException,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ORGANIZATION_CONTEXT_HEADER } from '@snapflow/organization-access';
import type { Request } from 'express';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import {
	isOrganizationAuthContext,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { millisecondsBetween } from '../../common/utils/time.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { ORGANIZATION_ERROR } from '../../organization/constants/organization-errors.constants';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import { OrganizationService } from '../../organization/services/organization.service';
import { permissionPairs } from '../../organization/utils/organization-permissions.util';
import { AUTH_ERROR } from '../constants/auth-errors.constants';
import { AuthMethod } from '../constants/auth-method.constants';
import { SESSION_FRESH_AGE_SECONDS } from '../constants/auth-security.constants';
import { ALLOW_AUTH_METHODS_KEY } from '../decorators/allow-auth-methods.decorator';
import { PUBLIC_ENDPOINT_KEY } from '../decorators/public-endpoint.decorator';
import { REQUIRE_FRESH_SESSION_KEY } from '../decorators/require-fresh-session.decorator';
import {
	AuthAddonService,
	type AuthenticationResult,
} from '../services/auth-addon.service';
import { OrganizationAccessService } from '../services/organization-access.service';
import { assertOrganizationContext } from '../utils/organization-context.util';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);
const ORIGIN_HEADER = 'origin';
const FETCH_SITE_HEADER = 'sec-fetch-site';
// Sandboxes are same-site in deployments that share a registrable domain, so
// only same-origin and user-initiated requests may omit the Origin header.
const ORIGINLESS_FETCH_SITES: ReadonlySet<string> = new Set([
	'same-origin',
	'none',
]);
const DEFAULT_AUTH_METHODS: readonly AuthMethod[] = [
	AuthMethod.SESSION,
	AuthMethod.API_KEY,
];
const SESSION_FRESH_AGE_MILLISECONDS =
	SESSION_FRESH_AGE_SECONDS * MILLISECONDS_PER_SECOND;

@Injectable()
export class SnapflowAuthGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly authAddonService: AuthAddonService,
		private readonly organizationAccess: OrganizationAccessService,
		private readonly organizations: OrganizationService,
		private readonly configService: TypedConfigService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		const targets = [context.getHandler(), context.getClass()];
		if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ENDPOINT_KEY, targets))
			return true;

		const result = await this.authAddonService.authenticate(
			request,
			this.reflector.getAllAndOverride<AuthMethod[]>(
				ALLOW_AUTH_METHODS_KEY,
				targets
			) ?? DEFAULT_AUTH_METHODS
		);
		if (!result) throw new UnauthorizedException('Authentication required');

		request.user = result.user;
		request.authMethod = result.method;
		request.authSession =
			result.method === AuthMethod.SESSION ? result.authSession : undefined;
		if (
			this.reflector.getAllAndOverride<boolean>(
				REQUIRE_FRESH_SESSION_KEY,
				targets
			)
		) {
			assertFreshSession(result);
		}
		this.assertTrustedSessionOrigin(request);
		assertOrganizationContextKept(request, result);
		await this.assertOrganizationPermissions(context, result.user);
		return true;
	}

	private async assertOrganizationPermissions(
		context: ExecutionContext,
		user: AuthenticationResult['user']
	): Promise<void> {
		const targets = [context.getHandler(), context.getClass()];
		const required = this.reflector.getAllAndOverride(
			RequiredOrganizationPermissions,
			targets
		);
		const requiredAny = this.reflector.getAllAndOverride(
			RequiredAnyOrganizationPermissions,
			targets
		);
		if (!required && !requiredAny) return;
		if (!isOrganizationAuthContext(user)) throw new AccessDeniedException();
		await this.organizations.assertActive(user.organizationId);
		if (
			(required && !(await this.grantsAll(user, permissionPairs(required)))) ||
			(requiredAny &&
				!(await this.grantsAny(user, permissionPairs(requiredAny))))
		) {
			throw new AccessDeniedException();
		}
	}

	private async grantsAll(
		user: OrganizationAuthContext,
		required: ReturnType<typeof permissionPairs>
	): Promise<boolean> {
		const granted = await this.organizationAccess.grantedToContext(
			user,
			required
		);
		return granted.length === required.length;
	}

	private async grantsAny(
		user: OrganizationAuthContext,
		required: ReturnType<typeof permissionPairs>
	): Promise<boolean> {
		return (
			(await this.organizationAccess.grantedToContext(user, required)).length >
			0
		);
	}

	private assertTrustedSessionOrigin(request: Request): void {
		if (
			request.authMethod !== AuthMethod.SESSION ||
			SAFE_METHODS.has(request.method.toUpperCase())
		) {
			return;
		}
		const origin = request.get(ORIGIN_HEADER);
		if (!origin) {
			const fetchSite = request.get(FETCH_SITE_HEADER);
			if (fetchSite !== undefined && !ORIGINLESS_FETCH_SITES.has(fetchSite)) {
				throw new ForbiddenException('Cross-site session request denied');
			}
			return;
		}
		const trustedOrigins = new Set(this.configService.get('trustedWebOrigins'));
		if (!trustedOrigins.has(origin)) {
			throw new ForbiddenException('Untrusted request origin');
		}
	}
}

function assertFreshSession(result: AuthenticationResult): void {
	if (
		result.method !== AuthMethod.SESSION ||
		!isFresh(result.authSession.session.createdAt)
	) {
		throw new ForbiddenException(AUTH_ERROR.FRESH_SESSION_REQUIRED);
	}
}

function isFresh(createdAt: Date): boolean {
	return (
		millisecondsBetween(new Date(createdAt), new Date()) <
		SESSION_FRESH_AGE_MILLISECONDS
	);
}

function assertOrganizationContextKept(
	request: Request,
	result: AuthenticationResult
): void {
	if (result.method !== AuthMethod.SESSION) return;
	assertOrganizationContext(
		request.headers[ORGANIZATION_CONTEXT_HEADER],
		result.user.organizationId
	);
	if (
		result.activeOrganizationReset &&
		!SAFE_METHODS.has(request.method.toUpperCase())
	) {
		throw new ConflictException(ORGANIZATION_ERROR.CONTEXT_CHANGED);
	}
}
