/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Headers,
	HttpStatus,
	Put,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiHeader,
	ApiOperation,
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
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { AutoTopUpDto, UpdateAutoTopUpDto } from '../dto/auto-top-up.dto';
import { AutoTopUpService } from '../services/auto-top-up.service';

const IF_MATCH_HEADER = 'if-match';
const EXPECTED_VERSION_PATTERN = /^(?:W\/)?"?(\d+)"?$/;

function parseExpectedVersion(ifMatch: string | undefined): number {
	const match = ifMatch?.trim().match(EXPECTED_VERSION_PATTERN);
	if (!match) {
		throw new BadRequestException('If-Match resource version is required');
	}
	return Number(match[1]);
}

@Controller('billing/auto-top-up')
@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class AutoTopUpController {
	constructor(private readonly autoTopUps: AutoTopUpService) {}

	@Get()
	@ApiOperation({
		summary: 'Get the automatic top-up of the active organization',
		operationId: 'getAutoTopUp',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AutoTopUpDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	getAutoTopUp(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<AutoTopUpDto> {
		return this.autoTopUps.get(authContext.organizationId);
	}

	@Put()
	@ApiOperation({
		summary: 'Consent to and configure the automatic top-up',
		operationId: 'updateAutoTopUp',
	})
	@ApiHeader({
		name: IF_MATCH_HEADER,
		description: 'The resourceVersion the change is based on; 0 creates it',
		required: true,
	})
	@ApiResponse({ status: HttpStatus.OK, type: AutoTopUpDto })
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	@AllowAuthMethods([AuthMethod.SESSION])
	@Audit({ action: AuditAction.UPDATE, targetType: AuditTarget.BILLING })
	async updateAutoTopUp(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Headers(IF_MATCH_HEADER) ifMatch: string | undefined,
		@Body() input: UpdateAutoTopUpDto
	): Promise<AutoTopUpDto> {
		const policy = await this.autoTopUps.update(
			{
				organizationId: authContext.organizationId,
				userId: authContext.userId,
			},
			parseExpectedVersion(ifMatch),
			input
		);
		return AutoTopUpDto.from(policy);
	}
}
