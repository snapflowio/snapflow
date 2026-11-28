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
import { AbuseCaseDto } from '../dto/abuse-case.dto';
import {
	AbuseReportDetailDto,
	AbuseReportDto,
	AbuseReportListQueryDto,
	AbuseReportPageDto,
	ApplyAbuseCaseActionDto,
	DecideAbuseReportDto,
} from '../dto/abuse-report.dto';
import { AbuseCaseActionService } from '../services/abuse-case-action.service';
import { AbuseCounterNoticeService } from '../services/abuse-counter-notice.service';
import { AbuseReportReviewService } from '../services/abuse-report-review.service';

const REPORT_ID_PARAM = {
	name: 'reportId',
	description: 'Abuse report ID',
	type: String,
} as const;

const CASE_ID_PARAM = {
	name: 'caseId',
	description: 'Abuse case ID',
	type: String,
} as const;

@Controller('admin/abuse-reports')
@ApiTags(OpenApiTag.ADMIN)
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
export class AdminAbuseReportController {
	constructor(
		private readonly reviews: AbuseReportReviewService,
		private readonly actions: AbuseCaseActionService,
		private readonly counterNotices: AbuseCounterNoticeService
	) {}

	@Get()
	@ApiOperation({
		summary: 'List abuse reports, soonest response deadline first',
		operationId: 'adminListAbuseReports',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AbuseReportPageDto })
	list(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Query() query: AbuseReportListQueryDto
	): Promise<AbuseReportPageDto> {
		return this.reviews.list(query, context.userId);
	}

	@Get(':reportId')
	@ApiOperation({
		summary:
			'Read an abuse report with its case, preserved evidence and action history',
		operationId: 'adminGetAbuseReport',
	})
	@ApiParam(REPORT_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: AbuseReportDetailDto })
	detail(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('reportId', ParseUUIDPipe) reportId: string
	): Promise<AbuseReportDetailDto> {
		return this.reviews.detail(reportId, context.userId);
	}

	@Post(':reportId/court-action')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Record that the copyright complainant filed a court action, which stops the counter-notice restoration (17 USC 512(g)(2)(C))',
		operationId: 'adminRecordAbuseCourtAction',
	})
	@ApiParam(REPORT_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: AbuseReportDto })
	@Audit({
		action: AuditAction.RECORD_ABUSE_COURT_ACTION,
		targetType: AuditTarget.ABUSE_REPORT,
		targetIdFromRequest: (request) => request.params.reportId,
	})
	recordCourtAction(
		@Param('reportId', ParseUUIDPipe) reportId: string
	): Promise<AbuseReportDto> {
		return this.counterNotices.recordCourtAction(reportId);
	}

	@Post(':reportId/counter-notice-forwarded')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Record that staff sent the complainant a copy of the counter-notice outside Snapflow, which lets the restoration proceed (17 USC 512(g)(2)(B))',
		operationId: 'adminRecordAbuseCounterNoticeForwarded',
	})
	@ApiParam(REPORT_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: AbuseReportDto })
	@Audit({
		action: AuditAction.RECORD_ABUSE_COUNTER_NOTICE_FORWARDED,
		targetType: AuditTarget.ABUSE_REPORT,
		targetIdFromRequest: (request) => request.params.reportId,
	})
	recordCounterNoticeForwarded(
		@Param('reportId', ParseUUIDPipe) reportId: string
	): Promise<AbuseReportDto> {
		return this.counterNotices.recordCounterNoticeForwarded(reportId);
	}

	@Post(':reportId/decision')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Record the decision on an abuse report and tell the reporter',
		operationId: 'adminDecideAbuseReport',
	})
	@ApiParam(REPORT_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: AbuseReportDto })
	@Audit({
		action: AuditAction.DECIDE_ABUSE_REPORT,
		targetType: AuditTarget.ABUSE_REPORT,
		targetIdFromRequest: (request) => request.params.reportId,
	})
	decide(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('reportId', ParseUUIDPipe) reportId: string,
		@Body() decision: DecideAbuseReportDto
	): Promise<AbuseReportDto> {
		return this.reviews.decide(
			reportId,
			decision.decision,
			decision.note ?? null,
			context.userId
		);
	}

	@Post('cases/:caseId/actions')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Take a step on the abuse ladder for a case: disable previews, block egress, pause, terminate, suspend or refer',
		operationId: 'adminApplyAbuseCaseAction',
	})
	@ApiParam(CASE_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: AbuseCaseDto })
	@Audit({
		action: AuditAction.APPLY_ABUSE_ACTION,
		targetType: AuditTarget.ABUSE_CASE,
		targetIdFromRequest: (request) => request.params.caseId,
	})
	async applyAction(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('caseId', ParseUUIDPipe) caseId: string,
		@Body() step: ApplyAbuseCaseActionDto
	): Promise<AbuseCaseDto> {
		return AbuseCaseDto.from(
			await this.actions.apply(
				caseId,
				step.action,
				context.userId,
				step.note ?? null
			)
		);
	}
}
