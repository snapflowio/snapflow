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
import { Audit } from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { SandboxLeaseDto } from '../../../marketplace/machine/dto/sandbox-lease.dto';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import { SandboxPlacementControlService } from '../../placement/services/sandbox-placement-control.service';
import { ApiPlacementConflictResponse } from '../decorators/api-placement-conflict-response.decorator';
import { SandboxDto } from '../dto/sandbox.dto';
import {
	AcceptLeaseRenewalDto,
	MoveSandboxDto,
} from '../dto/sandbox-placement.dto';
import {
	BillingRestrictedErrorDto,
	MachineUnavailableErrorDto,
	PriceChangedErrorDto,
} from '../dto/sandbox-placement-error.dto';
import { SandboxAccessGuard } from '../guards/sandbox-access.guard';
import { SandboxLifecycleService } from '../services/lifecycle/sandbox-lifecycle.service';
import { SandboxService } from '../services/sandbox/sandbox.service';

const SANDBOX_PARAMETER = {
	name: 'sandboxIdOrName',
	description: 'ID or name of the sandbox',
	type: 'string',
} as const;

@Controller('sandbox')
@ApiTags('sandbox')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
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
			'Restores the latest backup onto the named machine, or onto the best matching machine at no more than the current price, and pins the sandbox there under a new lease.',
		operationId: 'moveSandbox',
	})
	@ApiParam(SANDBOX_PARAMETER)
	@ApiResponse({ status: HttpStatus.ACCEPTED, type: SandboxDto })
	@ApiPlacementConflictResponse(
		MachineUnavailableErrorDto,
		BillingRestrictedErrorDto
	)
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

	@Get(':sandboxIdOrName/lease')
	@ApiOperation({
		summary: 'Get the price lease of a sandbox',
		operationId: 'getSandboxLease',
	})
	@ApiParam(SANDBOX_PARAMETER)
	@ApiResponse({ status: HttpStatus.OK, type: SandboxLeaseDto })
	@UseGuards(SandboxAccessGuard)
	async getSandboxLease(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string
	): Promise<SandboxLeaseDto> {
		return this.placementControl.describeLease(
			await this.sandboxes.findOneByIdOrName(
				sandboxIdOrName,
				authContext.organizationId
			)
		);
	}

	@Post(':sandboxIdOrName/lease/renewal')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Accept the current price for a lease that needs renewal',
		operationId: 'acceptSandboxLeaseRenewal',
	})
	@ApiParam(SANDBOX_PARAMETER)
	@ApiResponse({ status: HttpStatus.OK, type: SandboxLeaseDto })
	@ApiPlacementConflictResponse(
		PriceChangedErrorDto,
		MachineUnavailableErrorDto
	)
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	async acceptSandboxLeaseRenewal(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Body() input: AcceptLeaseRenewalDto
	): Promise<SandboxLeaseDto> {
		return this.placementControl.acceptRenewal(
			await this.sandboxes.findOneByIdOrName(
				sandboxIdOrName,
				authContext.organizationId
			),
			input.priceCardId
		);
	}
}
