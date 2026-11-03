/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { IncomingHttpHeaders } from 'node:http';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { parseOrganizationRoles } from '@snapflow/organization-access';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { HealthCheckAuthContext } from '../../common/types/health-check-auth-context.types';
import {
	AUTH_CREDENTIAL_TYPES,
	type AuthCredential,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { PLATFORM_PRINCIPAL_TYPE } from '../../common/types/platform-principal.types';
import { secretsEqual } from '../../common/utils/secret-comparison.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import type { Member } from '../../organization/tenant/entities/member.entity';
import { OrganizationService } from '../../organization/tenant/services/organization.service';
import { toCredentialPermissions } from '../../organization/tenant/utils/organization-permissions.util';
import type { User } from '../../user/entities/user.entity';
import { SystemRole } from '../../user/enums/system-role.enum';
import { UserService } from '../../user/services/user.service';
import { isBanActive } from '../../user/utils/user-ban.util';
import type { Auth } from '../better-auth/better-auth.config';
import { InjectBetterAuth } from '../better-auth/better-auth.provider';
import type { AuthMethod } from '../constants/auth-method.constants';
import {
	isApiKeyToken,
	readCredentialHeaders,
} from '../utils/api-key-header.util';
import { apiKeyCreator } from '../utils/api-key-metadata.util';
import { hasVerifiedSecondFactor } from '../utils/second-factor.util';

export type AuthSessionPayload = Auth['$Infer']['Session'];

type PlatformAuthContext = OrganizationAuthContext | HealthCheckAuthContext;

export type AuthenticationResult =
	| { user: PlatformAuthContext; method: 'api-key' }
	| {
			user: OrganizationAuthContext;
			method: 'session';
			authSession: AuthSessionPayload;
			activeOrganizationReset: boolean;
	  };

@Injectable()
export class AuthAddonService {
	private readonly logger = new Logger(AuthAddonService.name);

	constructor(
		@InjectBetterAuth() private readonly auth: Auth,
		private readonly userService: UserService,
		private readonly organizations: OrganizationService,
		private readonly configService: TypedConfigService
	) {}

	async authenticate(
		request: Request,
		allowedMethods: readonly AuthMethod[]
	): Promise<AuthenticationResult | null> {
		const methods = new Set(allowedMethods);
		const { apiKeyHeader, bearer } = readCredentialHeaders(
			fromNodeHeaders(request.headers)
		);
		if (apiKeyHeader && bearer) {
			throw new UnauthorizedException(
				'Multiple authentication credentials are not allowed'
			);
		}

		const token = apiKeyHeader ?? bearer;
		if (methods.has('api-key') && token) {
			if (this.isHealthCheckKey(token)) {
				return { method: 'api-key', user: { role: 'health-check' } };
			}
			if (apiKeyHeader || isApiKeyToken(token)) {
				return this.validateApiKey(token);
			}
		}
		if (methods.has('session')) {
			return this.getSessionAuthContext(request.headers);
		}
		return null;
	}

	async getAuthSession(
		headers: IncomingHttpHeaders
	): Promise<AuthSessionPayload | null> {
		const session = await this.auth.api.getSession({
			headers: fromNodeHeaders(headers),
		});
		return session?.user ? session : null;
	}

	hasVerifiedSecondFactor(
		authSession: AuthSessionPayload,
		headers: IncomingHttpHeaders
	): Promise<boolean> {
		return hasVerifiedSecondFactor({
			session: authSession.session,
			twoFactorEnabled: authSession.user.twoFactorEnabled,
			countPasskeys: async () =>
				(
					await this.auth.api.listPasskeys({
						headers: fromNodeHeaders(headers),
					})
				).length,
		});
	}

	async authenticateApiKeyToken(
		token: string
	): Promise<PlatformAuthContext | null> {
		return (await this.validateApiKey(token))?.user ?? null;
	}

	async getSessionAuthContext(
		headers: IncomingHttpHeaders
	): Promise<Extract<AuthenticationResult, { method: 'session' }> | null> {
		const authSession = await this.getAuthSession(headers);
		if (!authSession) return null;
		const { activeOrganizationId, token } = authSession.session;
		const membership = await this.organizations.resolveMembership(
			authSession.user.id,
			activeOrganizationId
		);
		if (membership.organizationId !== activeOrganizationId) {
			const { internalAdapter } = await this.auth.$context;
			await internalAdapter.updateSession(token, {
				activeOrganizationId: membership.organizationId,
			});
		}
		const user = await this.createOrganizationAuthContext(
			authSession.user.id,
			membership,
			{ type: AUTH_CREDENTIAL_TYPES.SESSION, id: authSession.session.id }
		);
		return user
			? {
					method: 'session',
					authSession,
					user,
					activeOrganizationReset:
						Boolean(activeOrganizationId) &&
						membership.organizationId !== activeOrganizationId,
				}
			: null;
	}

	private isHealthCheckKey(token: string): boolean {
		const healthCheckKey = this.configService.get('healthCheck.apiKey');
		return healthCheckKey ? secretsEqual(healthCheckKey, token) : false;
	}

	private async validateApiKey(
		token: string
	): Promise<AuthenticationResult | null> {
		const result = await this.auth.api.verifyApiKey({
			body: { key: token },
		});
		if (!result.valid || !result.key) return null;

		const creatorId = apiKeyCreator(result.key.metadata);
		const membership = creatorId
			? await this.organizations.findMembership(
					result.key.referenceId,
					creatorId
				)
			: null;
		if (!membership) return null;

		const user = await this.createOrganizationAuthContext(
			membership.userId,
			membership,
			{
				type: AUTH_CREDENTIAL_TYPES.API_KEY,
				id: result.key.id,
				name: result.key.name ?? result.key.start ?? result.key.id,
				permissions: toCredentialPermissions(result.key.permissions),
			}
		);
		return user ? { method: 'api-key', user } : null;
	}

	private async createOrganizationAuthContext(
		userId: string,
		membership: Pick<Member, 'id' | 'organizationId' | 'role'>,
		credential: AuthCredential
	): Promise<OrganizationAuthContext | null> {
		const user = await this.userService.findOne(userId);
		if (!user || isBanActive(user)) return null;
		if (!isSystemRole(user)) {
			this.logger.error(
				`Credential ${credential.id} belongs to a user with an invalid system role`
			);
			return null;
		}
		return {
			role: user.role,
			principal: {
				type: PLATFORM_PRINCIPAL_TYPE.HUMAN,
				id: user.id,
				email: user.email,
				displayName: user.name,
				systemRole: user.role,
			},
			userId: user.id,
			email: user.email,
			organizationId: membership.organizationId,
			memberId: membership.id,
			memberRoles: parseOrganizationRoles(membership.role),
			credential,
		};
	}
}

function isSystemRole(user: Pick<User, 'role'>): boolean {
	return Object.values(SystemRole).includes(user.role);
}
