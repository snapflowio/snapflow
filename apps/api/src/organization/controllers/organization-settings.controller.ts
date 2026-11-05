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
	Get,
	HttpStatus,
	Patch,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
	Audit,
	type TypedRequest,
} from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import {
	isOrganizationAuthContext,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import {
	ACTIVE_ORGANIZATION_ROUTE,
	ORGANIZATIONS_API_TAG,
} from '../constants/organization-routes.constants';
import { RequiredOrganizationPermissions } from '../decorators/required-organization-permissions.decorator';
import {
	OrganizationSettingsDto,
	UpdateOrganizationSettingsDto,
} from '../dto/organization-settings.dto';
import { OrganizationSettingsService } from '../services/organization-settings.service';

const activeOrganizationId = (request: Request): string | null =>
	isOrganizationAuthContext(request.user) ? request.user.organizationId : null;

@Controller(ACTIVE_ORGANIZATION_ROUTE)
@ApiTags(ORGANIZATIONS_API_TAG)
@AllowAuthMethods([AuthMethod.SESSION])
@UseGuards(AuthenticatedRateLimitGuard)
export class OrganizationSettingsController {
	constructor(private readonly settings: OrganizationSettingsService) {}

	@Get('settings')
	@ApiOperation({
		summary: 'Get the settings of the active organization',
		operationId: 'getOrganizationSettings',
	})
	@ApiResponse({ status: HttpStatus.OK, type: OrganizationSettingsDto })
	getSettings(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<OrganizationSettingsDto> {
		return this.settings.get(authContext.organizationId);
	}

	@Patch('settings')
	@ApiOperation({
		summary: 'Update the settings of the active organization',
		operationId: 'updateOrganizationSettings',
	})
	@ApiResponse({ status: HttpStatus.OK, type: OrganizationSettingsDto })
	@RequiredOrganizationPermissions({ organization: ['update'] })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.ORGANIZATION,
		targetIdFromRequest: activeOrganizationId,
		requestMetadata: {
			body: (request: TypedRequest<UpdateOrganizationSettingsDto>) => ({
				...request.body,
			}),
		},
	})
	updateSettings(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() changes: UpdateOrganizationSettingsDto
	): Promise<OrganizationSettingsDto> {
		return this.settings.update(authContext.organizationId, changes);
	}
}
