/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
	DelegatedSignerAuthorizationDto,
	VoucherDelegationDto,
} from '../dto/voucher-delegation.dto';
import { VoucherDelegationService } from '../services/vouchers/voucher-delegation.service';

@Controller('settlement/delegation')
@ApiTags(OpenApiTag.SETTLEMENT)
@ApiBearerAuth()
export class VoucherDelegationController {
	constructor(private readonly delegations: VoucherDelegationService) {}

	@Get()
	@ApiOperation({
		summary:
			"Get the organization's delegated voucher signer, its escrow grant with the hourly spending limit and bucket level in force, and a suggested limit that covers the running sandboxes",
		operationId: 'getVoucherDelegation',
	})
	@ApiResponse({ status: HttpStatus.OK, type: VoucherDelegationDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	delegation(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<VoucherDelegationDto> {
		return this.delegations.delegation(authContext.organizationId);
	}

	@Post('signer')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			"Create the funding wallet's delegated signer, or reuse one the escrow has not bound yet, and sign a fresh consent proof for authorizeSigner",
		operationId: 'createDelegatedSigner',
	})
	@ApiResponse({ status: HttpStatus.OK, type: DelegatedSignerAuthorizationDto })
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'No funding wallet is linked, or its delegated signer is already authorized (raise or lower its limit instead)',
	})
	@ApiResponse({
		status: HttpStatus.SERVICE_UNAVAILABLE,
		description: 'The key vault or the settlement chain is unavailable',
	})
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	createDelegatedSigner(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<DelegatedSignerAuthorizationDto> {
		return this.delegations.authorize(authContext.organizationId);
	}
}
