/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Controller,
	Delete,
	HttpCode,
	HttpStatus,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Audit } from '../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../audit/log/enums/audit-target.enum';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import {
	isOrganizationAuthContext,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import {
	ACTIVE_ORGANIZATION_ROUTE,
	ORGANIZATIONS_API_TAG,
} from '../../organization/tenant/constants/organization-routes.constants';
import { RequiredOrganizationPermissions } from '../../organization/tenant/decorators/required-organization-permissions.decorator';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../decorators/allow-auth-methods.decorator';
import { RequireFreshSession } from '../decorators/require-fresh-session.decorator';
import { OrganizationDeletionService } from '../services/organization-deletion.service';

const activeOrganizationId = (request: Request): string | null =>
	isOrganizationAuthContext(request.user) ? request.user.organizationId : null;

@Controller(ACTIVE_ORGANIZATION_ROUTE)
@ApiTags(ORGANIZATIONS_API_TAG)
@AllowAuthMethods([AuthMethod.SESSION])
@UseGuards(AuthenticatedRateLimitGuard)
export class OrganizationDeletionController {
	constructor(private readonly deletion: OrganizationDeletionService) {}

	@Delete()
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Delete the active organization',
		operationId: 'deleteActiveOrganization',
	})
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description:
			'The organization is deleted and every member loses access to it.',
	})
	@RequireFreshSession()
	@RequiredOrganizationPermissions({ organization: ['delete'] })
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.ORGANIZATION,
		targetIdFromRequest: activeOrganizationId,
	})
	async deleteActiveOrganization(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<void> {
		await this.deletion.delete(authContext.organizationId);
	}
}
