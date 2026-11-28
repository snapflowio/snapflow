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
	Post,
	UseGuards,
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
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { SandboxPriceDto } from '../../marketplace/dto/sandbox-price.dto';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import { SandboxPlacementControlService } from '../../placement/services/sandbox-placement-control.service';
import { ApiPaymentRequiredResponse } from '../decorators/api-payment-required-response.decorator';
import { ApiPlacementConflictResponse } from '../decorators/api-placement-conflict-response.decorator';
import { SandboxDto } from '../dto/sandbox.dto';
import { MoveSandboxDto } from '../dto/sandbox-placement.dto';
import { MachineUnavailableErrorDto } from '../dto/sandbox-placement-error.dto';
import { SandboxAccessGuard } from '../guards/sandbox-access.guard';
import { SandboxLifecycleService } from '../services/lifecycle/sandbox-lifecycle.service';
import { SandboxService } from '../services/sandbox/sandbox.service';

const SANDBOX_PARAMETER = {
	name: 'sandboxIdOrName',
	description: 'ID or name of the sandbox',
	type: 'string',
} as const;

@Controller('sandbox')
@ApiTags(OpenApiTag.SANDBOXES)
@ApiBearerAuth()
@ApiErrorResponse()
export class SandboxPlacementController {
	constructor(
		private readonly sandboxes: SandboxService,
		private readonly lifecycle: SandboxLifecycleService,
		private readonly placementControl: SandboxPlacementControlService
	) {}

	@Post(':sandboxIdOrName/move')
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({
		summary: 'Move a stopped sandbox to another machine',
		description:
			'Restores the latest backup onto the named machine, or onto the best matching machine at no more than the current price, and pins the sandbox there at a new placement price.',
		operationId: 'moveSandbox',
	})
	@ApiParam(SANDBOX_PARAMETER)
	@ApiResponse({ status: HttpStatus.ACCEPTED, type: SandboxDto })
	@ApiPlacementConflictResponse(MachineUnavailableErrorDto)
	@ApiPaymentRequiredResponse()
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.START,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
	})
	async moveSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Body() input: MoveSandboxDto
	): Promise<SandboxDto> {
		return SandboxDto.from(
			await this.lifecycle.move(
				sandboxIdOrName,
				authContext.organizationId,
				input
			)
		);
	}

	@Get(':sandboxIdOrName/price')
	@ApiOperation({
		summary: 'Get the price a sandbox runs at',
		operationId: 'getSandboxPrice',
	})
	@ApiParam(SANDBOX_PARAMETER)
	@ApiResponse({ status: HttpStatus.OK, type: SandboxPriceDto })
	@UseGuards(SandboxAccessGuard)
	@RequiredAnyOrganizationPermissions({
		sandboxes: ['read', 'write', 'delete'],
	})
	async getSandboxPrice(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string
	): Promise<SandboxPriceDto> {
		return this.placementControl.describePrice(
			await this.sandboxes.findOneByIdOrName(
				sandboxIdOrName,
				authContext.organizationId
			)
		);
	}
}
