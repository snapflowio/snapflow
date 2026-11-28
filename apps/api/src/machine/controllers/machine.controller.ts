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
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Put,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Audit, TypedRequest } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { TermsAcceptanceExempt } from '../../legal/decorators/terms-acceptance-exempt.decorator';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { MachineDto, MachineListQueryDto } from '../dto/machine.dto';
import { MachineFullDto, MachineFullPageDto } from '../dto/machine-full.dto';
import { MachineHostSettingsDto } from '../dto/machine-host-settings.dto';
import {
	UpdateMachineDrainingDto,
	UpdateMachineSchedulingDto,
} from '../dto/machine-lifecycle.dto';
import { MachineTrustDto } from '../dto/machine-trust.dto';
import { MachineAccessGuard } from '../guards/machine-access.guard';
import { MachineHostSettingsService } from '../services/host-settings/machine-host-settings.service';
import { MachineAdministrationService } from '../services/machine-administration.service';
import { MachineDirectoryService } from '../services/machine-directory.service';
import { MachineTrustService } from '../services/machine-trust.service';

@Controller('machines')
@ApiTags(OpenApiTag.MACHINES)
@ApiBearerAuth()
export class MachineController {
	constructor(
		private readonly machineDirectory: MachineDirectoryService,
		private readonly machineAdministration: MachineAdministrationService,
		private readonly machineTrustService: MachineTrustService,
		private readonly hostSettings: MachineHostSettingsService
	) {}

	@Get(':machineId/trust')
	@ApiOperation({
		summary: 'Get the machine-safe machine qualification and reliability view',
		operationId: 'getMachineTrust',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineTrustDto })
	@UseGuards(MachineAccessGuard)
	@RequiredOrganizationPermissions({ machines: ['read'] })
	getMachineTrust(
		@Param('machineId', ParseUUIDPipe) machineId: string
	): Promise<MachineTrustDto> {
		return this.machineTrustService.getMachineTrust(machineId);
	}

	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Get machine by ID', operationId: 'getMachineById' })
	@ApiParam({ name: 'id', description: 'Machine ID', type: String })
	@ApiResponse({ status: HttpStatus.OK, type: MachineFullDto })
	@UseGuards(MachineAccessGuard)
	@RequiredOrganizationPermissions({ machines: ['read'] })
	getMachineById(
		@Param('id', ParseUUIDPipe) id: string
	): Promise<MachineFullDto> {
		return this.machineDirectory.findOneFullOrFail(id);
	}

	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'List all machines', operationId: 'listMachines' })
	@ApiResponse({ status: HttpStatus.OK, type: MachineFullPageDto })
	@RequiredOrganizationPermissions({ machines: ['read'] })
	findAll(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: MachineListQueryDto
	): Promise<MachineFullPageDto> {
		return this.machineDirectory.findAllByOrganization(
			authContext.organizationId,
			query
		);
	}

	@Patch(':id/scheduling')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update machine scheduling status',
		operationId: 'updateMachineScheduling',
	})
	@ApiParam({ name: 'id', description: 'Machine ID', type: String })
	@ApiResponse({ status: HttpStatus.OK, type: MachineDto })
	@UseGuards(MachineAccessGuard)
	@RequiredOrganizationPermissions({ machines: ['write'] })
	@Audit({
		action: AuditAction.UPDATE_SCHEDULING,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: (request) => request.params.id,
		requestMetadata: {
			body: (request: TypedRequest<UpdateMachineSchedulingDto>) => ({
				unschedulable: request.body?.unschedulable,
			}),
		},
	})
	async updateSchedulingStatus(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() body: UpdateMachineSchedulingDto
	): Promise<MachineDto> {
		return MachineDto.from(
			await this.machineAdministration.updateSchedulingStatus(
				id,
				body.unschedulable
			)
		);
	}

	@Patch(':id/draining')
	@TermsAcceptanceExempt(
		({ body }: TypedRequest<UpdateMachineDrainingDto>) =>
			body?.draining === true
	)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Withdraw the machine or return it to service',
		description:
			'Draining withdraws the machine: it is unlisted and takes no new sandboxes, its sandboxes are stopped and archived so they restore on other machines, and it is decommissioned once empty. Returning it to service clears the withdrawal; the host relists it.',
		operationId: 'updateMachineDraining',
	})
	@ApiParam({ name: 'id', description: 'Machine ID', type: String })
	@ApiResponse({ status: HttpStatus.OK, type: MachineDto })
	@UseGuards(MachineAccessGuard)
	@RequiredOrganizationPermissions({ machines: ['write'] })
	@Audit({
		action: AuditAction.UPDATE_DRAINING,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: (request) => request.params.id,
		requestMetadata: {
			body: (request: TypedRequest<UpdateMachineDrainingDto>) => ({
				draining: request.body?.draining,
			}),
		},
	})
	async updateDrainingStatus(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() body: UpdateMachineDrainingDto
	): Promise<MachineDto> {
		return MachineDto.from(
			body.draining
				? await this.machineAdministration.withdraw(id)
				: await this.machineAdministration.updateDrainingStatus(id, false)
		);
	}

	@Put(':id/host-settings')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Set what the machine offers, its maintenance window and its maximum unclaimed float; the machine applies them',
		operationId: 'setMachineHostSettings',
	})
	@ApiParam({ name: 'id', description: 'Machine ID', type: String })
	@ApiResponse({ status: HttpStatus.OK, type: MachineDto })
	@UseGuards(MachineAccessGuard)
	@RequiredOrganizationPermissions({ machines: ['write'] })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: (request) => request.params.id,
		requestMetadata: {
			body: (request: TypedRequest<MachineHostSettingsDto>) => ({
				...request.body,
			}),
		},
	})
	async setHostSettings(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() settings: MachineHostSettingsDto
	): Promise<MachineDto> {
		return MachineDto.from(await this.hostSettings.set(id, settings));
	}

	@Post(':id/identity/revoke')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Revoke the machine identity and all active sessions',
		operationId: 'revokeMachineIdentity',
	})
	@ApiParam({ name: 'id', description: 'Machine ID', type: String })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@UseGuards(MachineAccessGuard)
	@RequiredOrganizationPermissions({ machines: ['delete'] })
	@Audit({
		action: AuditAction.REVOKE_MACHINE_IDENTITY,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: (request) => request.params.id,
	})
	async revokeIdentity(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
		await this.machineAdministration.revokeIdentity(id);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Delete machine', operationId: 'deleteMachine' })
	@ApiParam({ name: 'id', description: 'Machine ID', type: String })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@UseGuards(MachineAccessGuard)
	@RequiredOrganizationPermissions({ machines: ['delete'] })
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: (request) => request.params.id,
	})
	async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
		await this.machineAdministration.remove(id);
	}
}
