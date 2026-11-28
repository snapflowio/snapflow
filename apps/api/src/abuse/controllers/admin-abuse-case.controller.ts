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
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';
import {
	AbuseCaseDto,
	AbuseCaseListQueryDto,
	AbuseCasePageDto,
} from '../dto/abuse-case.dto';
import { AbuseCaseService } from '../services/abuse-case.service';

const CASE_ID_PARAM = {
	name: 'caseId',
	description: 'Abuse case ID',
	type: String,
} as const;

@Controller('admin/abuse-cases')
@ApiTags(OpenApiTag.ADMIN)
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
export class AdminAbuseCaseController {
	constructor(private readonly cases: AbuseCaseService) {}

	@Get()
	@ApiOperation({
		summary: 'List sandboxes flagged for abuse, most recently seen first',
		operationId: 'adminListAbuseCases',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AbuseCasePageDto })
	list(@Query() query: AbuseCaseListQueryDto): Promise<AbuseCasePageDto> {
		return this.cases.list(query);
	}

	@Post(':caseId/resolution')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Resolve an abuse case: release its throttle and lift the abuse suspension of its organization',
		operationId: 'adminResolveAbuseCase',
	})
	@ApiParam(CASE_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: AbuseCaseDto })
	@Audit({
		action: AuditAction.RESOLVE_ABUSE_CASE,
		targetType: AuditTarget.ABUSE_CASE,
		targetIdFromRequest: (request) => request.params.caseId,
	})
	resolve(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('caseId', ParseUUIDPipe) caseId: string
	): Promise<AbuseCaseDto> {
		return this.cases.resolve(caseId, context.userId);
	}
}
