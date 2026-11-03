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
	Delete,
	HttpCode,
	HttpStatus,
	Param,
	ParseBoolPipe,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Audit } from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { ThrottlerScope } from '../../../common/decorators/throttler-scope.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import { ApiPlacementConflictResponse } from '../decorators/api-placement-conflict-response.decorator';
import { SandboxDto } from '../dto/sandbox.dto';
import { StartSandboxDto } from '../dto/sandbox-placement.dto';
import {
	BillingRestrictedErrorDto,
	LeaseRenewalRequiredErrorDto,
	MachineUnavailableErrorDto,
	PriceChangedErrorDto,
} from '../dto/sandbox-placement-error.dto';
import { SandboxAccessGuard } from '../guards/sandbox-access.guard';
import { SandboxLifecycleService } from '../services/lifecycle/sandbox-lifecycle.service';
import { SandboxRecoveryService } from '../services/lifecycle/sandbox-recovery.service';

@Controller('sandbox')
@ApiTags('sandbox')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class SandboxLifecycleController {
	constructor(
		private readonly lifecycle: SandboxLifecycleService,
		private readonly recovery: SandboxRecoveryService
	) {}

	@Delete(':sandboxIdOrName')
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('sandbox-lifecycle')
	@ApiOperation({
		summary: 'Delete sandbox',
		operationId: 'deleteSandbox',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Sandbox has been deleted',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['delete'] })
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
	})
	async deleteSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string
	): Promise<SandboxDto> {
		const sandbox = await this.lifecycle.destroy(
			sandboxIdOrName,
			authContext.organizationId
		);
		return SandboxDto.from(sandbox);
	}

	@Post(':sandboxIdOrName/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('sandbox-lifecycle')
	@ApiOperation({
		summary: 'Recover sandbox from error state',
		description:
			'Accepts recovery and returns the durable sandbox lifecycle resource immediately.',
		operationId: 'recoverSandbox',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiQuery({
		name: 'skipStart',
		required: false,
		type: Boolean,
		description:
			'If true, the sandbox is left in STOPPED after recovery instead of being started.',
	})
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Recovery was durably accepted.',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.RECOVER,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			query: (req) => ({
				skipStart: req.query?.skipStart === 'true',
			}),
		},
	})
	async recoverSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Query('skipStart', new ParseBoolPipe({ optional: true }))
		skipStart?: boolean
	): Promise<SandboxDto> {
		const recoveredSandbox = await this.recovery.recover(
			sandboxIdOrName,
			authContext.organizationId,
			skipStart
		);
		return SandboxDto.from(recoveredSandbox);
	}

	@Post(':sandboxIdOrName/start')
	@HttpCode(HttpStatus.ACCEPTED)
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('sandbox-lifecycle')
	@ApiOperation({
		summary: 'Start or resume sandbox',
		description:
			'Accepts a start, restore, or resume transition and returns the durable sandbox lifecycle resource immediately. The transition taken depends on the current sandbox state.',
		operationId: 'startSandbox',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Sandbox lifecycle transition was durably accepted.',
		type: SandboxDto,
	})
	@ApiPlacementConflictResponse(
		MachineUnavailableErrorDto,
		PriceChangedErrorDto,
		LeaseRenewalRequiredErrorDto,
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
	async startSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Body() input: StartSandboxDto
	): Promise<SandboxDto> {
		const sbx = await this.lifecycle.start(
			sandboxIdOrName,
			authContext.organizationId,
			input
		);
		return SandboxDto.from(sbx);
	}

	@Post(':sandboxIdOrName/stop')
	@HttpCode(HttpStatus.OK)
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('sandbox-lifecycle')
	@ApiOperation({
		summary: 'Stop sandbox',
		operationId: 'stopSandbox',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiQuery({
		name: 'force',
		required: false,
		type: 'boolean',
		description: 'Force stop the sandbox using SIGKILL instead of SIGTERM',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Sandbox has been stopped',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.STOP,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			query: (req) => ({
				force: req.query?.force === 'true',
			}),
		},
	})
	async stopSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Query('force', new ParseBoolPipe({ optional: true })) force?: boolean
	): Promise<SandboxDto> {
		const sandbox = await this.lifecycle.stop(
			sandboxIdOrName,
			authContext.organizationId,
			force
		);
		return SandboxDto.from(sandbox);
	}

	@Post(':sandboxIdOrName/archive')
	@HttpCode(HttpStatus.OK)
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('sandbox-lifecycle')
	@ApiOperation({
		summary: 'Archive sandbox',
		operationId: 'archiveSandbox',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Sandbox has been archived',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.ARCHIVE,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
	})
	async archiveSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string
	): Promise<SandboxDto> {
		const sandbox = await this.lifecycle.archive(
			sandboxIdOrName,
			authContext.organizationId
		);
		return SandboxDto.from(sandbox);
	}
}
