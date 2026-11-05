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
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
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
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';
import {
	AdminListingDto,
	AdminListingPageDto,
	ListAdminListingsQueryDto,
	UpdateAdminMachineTierDto,
} from '../dto/admin-machine-tier.dto';
import {
	ListVerificationReviewsQueryDto,
	ResolveVerificationReviewDto,
	VerificationReviewDto,
	VerificationReviewPageDto,
} from '../dto/verification-review.dto';
import { MachineTierService } from '../services/machine-tier.service';
import { VerificationReviewService } from '../services/verification-review.service';

@Controller('admin')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminVerificationController {
	constructor(
		private readonly tiers: MachineTierService,
		private readonly reviews: VerificationReviewService
	) {}

	@Get('listings')
	@ApiOperation({
		summary: 'List machines with their verification tier',
		operationId: 'listAdminListings',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AdminListingPageDto })
	listAdminListings(
		@Query() query: ListAdminListingsQueryDto
	): Promise<AdminListingPageDto> {
		return this.tiers.listAdmin(query);
	}

	@Patch('machines/:machineId/tier')
	@ApiOperation({
		summary: 'Cap the tier of a machine or approve it as a datacenter',
		operationId: 'updateAdminMachineTier',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AdminListingDto })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: (request: Request) => request.params.machineId,
		requestMetadata: {
			body: (request: TypedRequest<UpdateAdminMachineTierDto>) => ({
				tierCap: request.body.tierCap,
				datacenterApproved: request.body.datacenterApproved,
				reason: request.body.reason,
			}),
		},
	})
	async updateAdminMachineTier(
		@Param('machineId', ParseUUIDPipe) machineId: string,
		@Body() input: UpdateAdminMachineTierDto
	): Promise<AdminListingDto> {
		return AdminListingDto.from(
			await this.tiers.updateAdminTier(machineId, input)
		);
	}

	@Get('verification/reviews')
	@ApiOperation({
		summary: 'List machine verification reviews',
		operationId: 'listVerificationReviews',
	})
	@ApiResponse({ status: HttpStatus.OK, type: VerificationReviewPageDto })
	listVerificationReviews(
		@Query() query: ListVerificationReviewsQueryDto
	): Promise<VerificationReviewPageDto> {
		return this.reviews.list(query);
	}

	@Post('verification/reviews/:reviewId/resolution')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Clear a verification review, forfeit held earnings or delist',
		operationId: 'resolveVerificationReview',
	})
	@ApiResponse({ status: HttpStatus.OK, type: VerificationReviewDto })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: (request: Request) => request.params.reviewId,
		requestMetadata: {
			body: (request: TypedRequest<ResolveVerificationReviewDto>) => ({
				outcome: request.body.outcome,
				reason: request.body.reason,
			}),
		},
	})
	async resolveVerificationReview(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('reviewId', ParseUUIDPipe) reviewId: string,
		@Body() input: ResolveVerificationReviewDto
	): Promise<VerificationReviewDto> {
		return VerificationReviewDto.from(
			await this.reviews.resolve(reviewId, input, context.userId)
		);
	}
}
