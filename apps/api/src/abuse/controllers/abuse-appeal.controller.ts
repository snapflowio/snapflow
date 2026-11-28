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
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { AbuseAppealDto } from '../dto/abuse-appeal.dto';
import { AppealAbuseDecisionDto } from '../dto/abuse-report-intake.dto';
import { AbuseAppealService } from '../services/abuse-appeal.service';

@Controller('abuse-cases')
@ApiTags(OpenApiTag.ABUSE)
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
export class AbuseAppealController {
	constructor(private readonly appeals: AbuseAppealService) {}

	@Get(':caseId/appeal')
	@ApiOperation({
		summary:
			"What happened to one of your organization's sandboxes and whether the decision can be appealed",
		operationId: 'getAbuseAppeal',
	})
	@ApiParam({ name: 'caseId', description: 'Abuse case ID', type: String })
	@ApiResponse({ status: HttpStatus.OK, type: AbuseAppealDto })
	summary(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('caseId', ParseUUIDPipe) caseId: string
	): Promise<AbuseAppealDto> {
		return this.appeals.summary(caseId, context.organizationId);
	}

	@Post(':caseId/appeal')
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@ApiOperation({
		summary:
			"Appeal an abuse decision on one of your organization's sandboxes; a person reviews every appeal",
		operationId: 'appealAbuseDecision',
	})
	@ApiParam({ name: 'caseId', description: 'Abuse case ID', type: String })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	appeal(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('caseId', ParseUUIDPipe) caseId: string,
		@Body() appeal: AppealAbuseDecisionDto
	): Promise<void> {
		return this.appeals.appeal(caseId, context.organizationId, appeal);
	}
}
