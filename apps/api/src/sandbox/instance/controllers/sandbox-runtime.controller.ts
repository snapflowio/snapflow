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
import { SkipThrottle } from '@nestjs/throttler';
import {
	Audit,
	TypedRequest,
} from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { ThrottlerScope } from '../../../common/decorators/throttler-scope.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import { PAUSE_WITH_MANAGED_SECRETS_UNSUPPORTED } from '../constants/sandbox.constants';
import { ResizeSandboxDto } from '../dto/resize-sandbox.dto';
import { SandboxDto } from '../dto/sandbox.dto';
import { UpdateSandboxNetworkSettingsDto } from '../dto/update-sandbox-network-settings.dto';
import { SandboxAccessGuard } from '../guards/sandbox-access.guard';
import { SandboxRuntimeOperationService } from '../services/sandbox/sandbox-runtime-operation.service';

@Controller('sandbox')
@ApiTags('sandbox')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class SandboxRuntimeController {
	constructor(
		private readonly runtimeOperations: SandboxRuntimeOperationService
	) {}

	@Post(':sandboxIdOrName/pause')
	@HttpCode(HttpStatus.OK)
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('sandbox-lifecycle')
	@ApiOperation({
		summary: 'Pause sandbox',
		operationId: 'pauseSandbox',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Sandbox pause has been initiated',
		type: SandboxDto,
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: `The sandbox is not started, uses a GPU, or has managed secrets: ${PAUSE_WITH_MANAGED_SECRETS_UNSUPPORTED}`,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.PAUSE,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
	})
	async pauseSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string
	): Promise<SandboxDto> {
		const sandbox = await this.runtimeOperations.pause(
			sandboxIdOrName,
			authContext.organizationId
		);
		return SandboxDto.from(sandbox);
	}

	@Post(':sandboxIdOrName/resize')
	@HttpCode(HttpStatus.OK)
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('sandbox-lifecycle')
	@ApiOperation({
		summary: 'Resize sandbox resources',
		operationId: 'resizeSandbox',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Sandbox has been resized',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.RESIZE,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			body: (req: TypedRequest<ResizeSandboxDto>) => ({
				cpu: req.body?.cpu,
				memory: req.body?.memory,
				disk: req.body?.disk,
			}),
		},
	})
	async resizeSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Body() resizeSandboxDto: ResizeSandboxDto
	): Promise<SandboxDto> {
		const sandbox = await this.runtimeOperations.resize(
			sandboxIdOrName,
			resizeSandboxDto,
			authContext.organizationId
		);
		return SandboxDto.from(sandbox);
	}

	@Post(':sandboxIdOrName/network-settings')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update sandbox network settings',
		operationId: 'updateNetworkSettings',
		description:
			'Changes outbound network policy on the machine for a running sandbox (for example block all traffic, restore access, or set a CIDR allow list).',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Network settings have been updated',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.UPDATE_NETWORK_SETTINGS,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			body: (req: TypedRequest<UpdateSandboxNetworkSettingsDto>) => ({
				networkBlockAll: req.body?.networkBlockAll,
				networkAllowList: req.body?.networkAllowList,
				domainAllowList: req.body?.domainAllowList,
			}),
		},
	})
	async updateNetworkSettings(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Body() networkSettings: UpdateSandboxNetworkSettingsDto
	): Promise<SandboxDto> {
		if (
			networkSettings.networkBlockAll === undefined &&
			networkSettings.networkAllowList === undefined &&
			networkSettings.domainAllowList === undefined &&
			networkSettings.egressBandwidthBps === undefined
		) {
			throw new BadRequestException(
				'At least one network policy setting must be provided'
			);
		}
		const sandbox = await this.runtimeOperations.updateNetworkSettings(
			sandboxIdOrName,
			authContext.organizationId,
			networkSettings.networkBlockAll,
			networkSettings.networkAllowList,
			networkSettings.domainAllowList,
			networkSettings.egressBandwidthBps
		);
		return SandboxDto.from(sandbox);
	}
}
