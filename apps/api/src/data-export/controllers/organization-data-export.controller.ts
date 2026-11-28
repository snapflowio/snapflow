/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus, StreamableFile } from '@nestjs/common';
import {
	ApiOperation,
	ApiProduces,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Audit } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { RequireFreshSession } from '../../auth/decorators/require-fresh-session.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import {
	isOrganizationAuthContext,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { ACTIVE_ORGANIZATION_ROUTE } from '../../organization/constants/organization-routes.constants';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { DATA_EXPORT } from '../constants/data-export.constants';
import { DataExportService } from '../services/data-export.service';
import { jsonDownload } from '../utils/json-download.util';

const activeOrganizationId = (request: Request): string | null =>
	isOrganizationAuthContext(request.user) ? request.user.organizationId : null;

@Controller(ACTIVE_ORGANIZATION_ROUTE)
@ApiTags(OpenApiTag.ORGANIZATIONS)
@AllowAuthMethods([AuthMethod.SESSION])
export class OrganizationDataExportController {
	constructor(private readonly exports: DataExportService) {}

	@Get('export')
	@ApiOperation({
		summary: 'Download the data Snapflow holds about the active organization',
		operationId: 'exportOrganizationData',
	})
	@ApiProduces(DATA_EXPORT.CONTENT_TYPE)
	@ApiResponse({
		status: HttpStatus.OK,
		schema: { type: 'string', format: 'binary' },
	})
	@RequireFreshSession()
	@RequiredOrganizationPermissions({ organization: ['delete'] })
	@Audit({
		action: AuditAction.EXPORT,
		targetType: AuditTarget.ORGANIZATION,
		targetIdFromRequest: activeOrganizationId,
	})
	async exportOrganizationData(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<StreamableFile> {
		return jsonDownload(
			await this.exports.organization(authContext.organizationId),
			DATA_EXPORT.ORGANIZATION_FILENAME
		);
	}
}
