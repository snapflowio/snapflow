/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Body, Controller, Get, HttpStatus, Put } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import {
	BillingProfileDto,
	UpdateBillingProfileDto,
} from '../dto/billing-profile.dto';
import { BillingProfileService } from '../services/billing-profile.service';

@Controller('billing/profile')
@ApiTags(OpenApiTag.BILLING)
@ApiBearerAuth()
export class BillingProfileController {
	constructor(private readonly profiles: BillingProfileService) {}

	@Get()
	@ApiOperation({
		summary: 'Get the billing details printed on the receipts',
		operationId: 'getBillingProfile',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingProfileDto })
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description:
			'The organization has no billing details yet (code billing_profile_not_found)',
	})
	@RequiredOrganizationPermissions({ billing: ['read'] })
	getBillingProfile(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<BillingProfileDto> {
		return this.profiles.get(authContext.organizationId);
	}

	@Put()
	@ApiOperation({
		summary:
			'Set the billing details printed on receipts issued from now on; issued receipts keep the details they were issued with',
		operationId: 'updateBillingProfile',
	})
	@ApiResponse({ status: HttpStatus.OK, type: BillingProfileDto })
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	updateBillingProfile(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: UpdateBillingProfileDto
	): Promise<BillingProfileDto> {
		return this.profiles.update(authContext.organizationId, input);
	}
}
