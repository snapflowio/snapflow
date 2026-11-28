/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import {
	type BaseAuthContext,
	isBaseAuthContext,
} from '../../common/types/base-auth-context.types';
import {
	AUTH_CREDENTIAL_TYPES,
	isOrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { getAuthContext } from '../../common/utils/auth-context.util';
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';
import { AdminMfaRequiredException } from '../../user/exceptions/admin-mfa-required.exception';
import { isPublicEndpoint } from '../decorators/public-endpoint.decorator';
import { AuthAddonService } from '../services/auth-addon.service';

type RoleRequirement = SystemRole | SystemRole[] | undefined;

@Injectable()
export class SystemActionGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly authAddonService: AuthAddonService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (isPublicEndpoint(context, this.reflector)) {
			return true;
		}

		const authContext = getAuthContext(context, isBaseAuthContext);
		const requirements: readonly RoleRequirement[] = this.reflector.getAll(
			RequiredSystemRole,
			[context.getHandler(), context.getClass()]
		);

		if (!admitsRole(requirements, authContext.role)) {
			throw new AccessDeniedException();
		}
		if (
			authContext.role === SystemRole.ADMIN &&
			requirements.some((requirement) => requirement !== undefined)
		) {
			await this.assertAdminSecondFactor(context);
		}

		return true;
	}

	private async assertAdminSecondFactor(
		context: ExecutionContext
	): Promise<void> {
		const request = context.switchToHttp().getRequest<Request>();
		const { authSession, user } = request;
		if (
			!authSession ||
			!isOrganizationAuthContext(user) ||
			user.credential.type !== AUTH_CREDENTIAL_TYPES.SESSION
		) {
			throw new AccessDeniedException();
		}
		if (
			!(await this.authAddonService.hasVerifiedSecondFactor(
				authSession,
				request.headers
			))
		) {
			throw new AdminMfaRequiredException();
		}
	}
}

function admitsRole(
	requirements: readonly RoleRequirement[],
	role: BaseAuthContext['role']
): boolean {
	return requirements.every(
		(requirement) =>
			requirement === undefined ||
			[requirement].flat().some((allowedRole) => allowedRole === role)
	);
}
