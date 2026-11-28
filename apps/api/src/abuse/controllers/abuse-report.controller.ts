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
	Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { ThrottlerScope } from '../../common/decorators/throttler-scope.decorator';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import {
	AbuseReportReceiptDto,
	CreateAbuseReportDto,
} from '../dto/abuse-report-intake.dto';
import { AbuseIntakeService } from '../services/abuse-intake.service';

@Controller('abuse-reports')
@ApiTags(OpenApiTag.ABUSE)
@PublicEndpoint()
export class AbuseReportController {
	constructor(private readonly intake: AbuseIntakeService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope(RateLimitThrottler.ABUSE_REPORTS)
	@ApiOperation({
		summary:
			'Report abuse on a Snapflow-hosted URL; files are never accepted, only the exact URL',
		operationId: 'submitAbuseReport',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: AbuseReportReceiptDto })
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'The human verification check failed',
	})
	submit(
		@Body() report: CreateAbuseReportDto,
		@Req() request: Request
	): Promise<AbuseReportReceiptDto> {
		return this.intake.submit(report, request.ip);
	}
}
