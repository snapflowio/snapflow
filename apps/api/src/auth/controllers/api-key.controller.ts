/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	Audit,
	type TypedRequest,
} from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import {
	permissionPairs,
	toCredentialPermissions,
} from '../../organization/utils/organization-permissions.util';
import type { Auth } from '../better-auth/better-auth.config';
import { InjectBetterAuth } from '../better-auth/better-auth.provider';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../decorators/allow-auth-methods.decorator';
import { RequireFreshSession } from '../decorators/require-fresh-session.decorator';
import { CreateApiKeyDto, CreatedApiKeyDto } from '../dto/api-key.dto';
import { OrganizationAccessService } from '../services/organization-access.service';
import { API_KEY_CREATOR_FIELD } from '../utils/api-key-metadata.util';

@Controller('api-keys')
@ApiTags('api-keys')
@AllowAuthMethods([AuthMethod.SESSION])
@UseGuards(AuthenticatedRateLimitGuard)
export class ApiKeyController {
	constructor(
		@InjectBetterAuth() private readonly auth: Auth,
		private readonly organizationAccess: OrganizationAccessService
	) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary:
			'Create an API key for the active organization with explicit permissions',
		operationId: 'createApiKey',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: CreatedApiKeyDto })
	@RequireFreshSession()
	@RequiredOrganizationPermissions({ apiKey: ['create'] })
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.API_KEY,
		targetIdFromResult: (result: CreatedApiKeyDto) => result.id,
		requestMetadata: {
			body: (request: TypedRequest<CreateApiKeyDto>) => ({
				name: request.body?.name,
				expiresIn: request.body?.expiresIn,
				permissions: request.body?.permissions,
			}),
		},
	})
	async create(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: CreateApiKeyDto
	): Promise<CreatedApiKeyDto> {
		const requested = permissionPairs(input.permissions);
		const granted = await this.organizationAccess.grantedToContext(
			authContext,
			requested
		);
		if (granted.length < requested.length) throw new AccessDeniedException();

		const created = await this.auth.api.createApiKey({
			body: {
				organizationId: authContext.organizationId,
				userId: authContext.userId,
				name: input.name,
				expiresIn: input.expiresIn ?? null,
				permissions: input.permissions,
				metadata: { [API_KEY_CREATOR_FIELD]: authContext.userId },
			},
		});
		return {
			id: created.id,
			organizationId: created.referenceId,
			name: created.name,
			key: created.key,
			start: created.start,
			permissions: toCredentialPermissions(created.permissions),
			expiresAt: created.expiresAt
				? new Date(created.expiresAt).toISOString()
				: null,
			createdAt: new Date(created.createdAt).toISOString(),
		};
	}
}
