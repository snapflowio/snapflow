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
	Post,
	Put,
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
import { Audit, TypedRequest } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { SandboxDto, SandboxLabelsDto } from '../dto/sandbox.dto';
import { SandboxAccessGuard } from '../guards/sandbox-access.guard';
import { SandboxService } from '../services/sandbox/sandbox.service';
import { SandboxActivityService } from '../services/sandbox/sandbox-activity.service';
import { SandboxSettingsService } from '../services/sandbox/sandbox-settings.service';

@Controller('sandbox')
@ApiTags('sandbox')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class SandboxSettingsController {
	constructor(
		private readonly sandboxService: SandboxService,
		private readonly settings: SandboxSettingsService,
		private readonly activity: SandboxActivityService
	) {}

	@Put(':sandboxIdOrName/labels')
	@ApiOperation({
		summary: 'Replace sandbox labels',
		operationId: 'replaceLabels',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Labels have been successfully replaced',
		type: SandboxLabelsDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.REPLACE_LABELS,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			body: (req: TypedRequest<SandboxLabelsDto>) => ({
				labels: req.body?.labels,
			}),
		},
	})
	async replaceLabels(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Body() labelsDto: SandboxLabelsDto
	): Promise<SandboxDto> {
		const sandbox = await this.settings.replaceLabels(
			sandboxIdOrName,
			labelsDto.labels,
			authContext.organizationId
		);
		return SandboxDto.from(sandbox);
	}

	@Post(':sandboxId/last-activity')
	@ApiOperation({
		summary: 'Update sandbox last activity',
		operationId: 'updateLastActivity',
	})
	@ApiParam({
		name: 'sandboxId',
		description: 'ID of the sandbox',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Last activity has been updated',
	})
	@UseGuards(SandboxAccessGuard)
	async updateLastActivity(
		@Param('sandboxId') sandboxId: string
	): Promise<void> {
		await this.activity.updateLastActivityAt(sandboxId, new Date());
	}

	@Post(':sandboxIdOrName/autostop/:interval')
	@ApiOperation({
		summary: 'Set sandbox auto-stop interval',
		operationId: 'setAutostopInterval',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiParam({
		name: 'interval',
		description: 'Auto-stop interval in minutes (0 to disable)',
		type: 'number',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Auto-stop interval has been set',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.SET_AUTO_STOP_INTERVAL,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			params: (req) => ({
				interval: req.params.interval,
			}),
		},
	})
	async setAutostopInterval(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Param('interval') interval: number
	): Promise<SandboxDto> {
		const sandbox = await this.settings.setAutostopInterval(
			sandboxIdOrName,
			interval,
			authContext.organizationId
		);
		return SandboxDto.from(sandbox);
	}

	@Post(':sandboxIdOrName/autoarchive/:interval')
	@ApiOperation({
		summary: 'Set sandbox auto-archive interval',
		operationId: 'setAutoArchiveInterval',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiParam({
		name: 'interval',
		description:
			'Auto-archive interval in minutes (0 means the maximum interval will be used)',
		type: 'number',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Auto-archive interval has been set',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.SET_AUTO_ARCHIVE_INTERVAL,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			params: (req) => ({
				interval: req.params.interval,
			}),
		},
	})
	async setAutoArchiveInterval(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Param('interval') interval: number
	): Promise<SandboxDto> {
		const sandbox = await this.settings.setAutoArchiveInterval(
			sandboxIdOrName,
			interval,
			authContext.organizationId
		);
		return SandboxDto.from(sandbox);
	}

	@Post(':sandboxIdOrName/autodelete/:interval')
	@ApiOperation({
		summary: 'Set sandbox auto-delete interval',
		operationId: 'setAutoDeleteInterval',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiParam({
		name: 'interval',
		description:
			'Auto-delete interval in minutes (negative value means disabled, 0 means delete immediately upon stopping)',
		type: 'number',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Auto-delete interval has been set',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.SET_AUTO_DELETE_INTERVAL,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			params: (req) => ({
				interval: req.params.interval,
			}),
		},
	})
	async setAutoDeleteInterval(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Param('interval') interval: number
	): Promise<SandboxDto> {
		const sandbox = await this.settings.setAutoDeleteInterval(
			sandboxIdOrName,
			interval,
			authContext.organizationId
		);
		return SandboxDto.from(sandbox);
	}

	@Delete(':sandboxIdOrName/ssh-access')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Revoke SSH access for sandbox',
		operationId: 'revokeSshAccess',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiQuery({
		name: 'token',
		required: false,
		type: String,
		description:
			'SSH access token to revoke. If not provided, all SSH access for the sandbox will be revoked.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'SSH access has been revoked',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.REVOKE_SSH_ACCESS,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			query: (req) => ({
				token: req.query.token,
			}),
		},
	})
	async revokeSshAccess(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Query('token') token?: string
	): Promise<SandboxDto> {
		const sandbox = await this.sandboxService.revokeSshAccess(
			sandboxIdOrName,
			token,
			authContext.organizationId
		);
		return SandboxDto.from(sandbox);
	}
}
