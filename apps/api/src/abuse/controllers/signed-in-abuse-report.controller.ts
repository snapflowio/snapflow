/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { ThrottlerScope } from '../../common/decorators/throttler-scope.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import {
	AbuseReportReceiptDto,
	CreateSignedInAbuseReportDto,
} from '../dto/abuse-report-intake.dto';
import { AbuseIntakeService } from '../services/abuse-intake.service';

@Controller('abuse-reports/signed-in')
@ApiTags(OpenApiTag.ABUSE)
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
export class SignedInAbuseReportController {
	constructor(private readonly intake: AbuseIntakeService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ThrottlerScope(RateLimitThrottler.ABUSE_REPORTS)
	@ApiOperation({
		summary:
			'Report abuse on a Snapflow-hosted URL as the signed-in user; files are never accepted, only the exact URL',
		operationId: 'submitSignedInAbuseReport',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: AbuseReportReceiptDto })
	submit(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Body() report: CreateSignedInAbuseReportDto
	): Promise<AbuseReportReceiptDto> {
		return this.intake.submitSignedIn(
			report,
			context.userId,
			context.organizationId
		);
	}
}
