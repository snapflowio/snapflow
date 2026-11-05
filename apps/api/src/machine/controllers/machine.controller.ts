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
	Query,
	Req,
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
import type { Request } from 'express';
import { Audit, TypedRequest } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { ThrottlerScope } from '../../common/decorators/throttler-scope.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import {
	MachineDto,
	MachineListQueryDto,
	MachinePageDto,
} from '../dto/machine.dto';
import {
	UpdateMachineDrainingDto,
	UpdateMachineSchedulingDto,
} from '../dto/machine-lifecycle.dto';
import {
	MachineRegistrationDto,
	RegisterMachineDto,
} from '../dto/machine-registration.dto';
import { MachineTrustDto } from '../dto/machine-trust.dto';
import { MachineAccessGuard } from '../guards/machine-access.guard';
import { MachineService } from '../services/machine.service';
import { MachineAdministrationService } from '../services/machine-administration.service';
import { MachineDirectoryService } from '../services/machine-directory.service';
import { MachineRegistrationService } from '../services/machine-registration.service';
import { MachineTrustService } from '../services/machine-trust.service';

@Controller('machines')
@ApiTags('machines')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class MachineController {
	constructor(
		private readonly machineService: MachineService,
		private readonly machineDirectory: MachineDirectoryService,
		private readonly machineAdministration: MachineAdministrationService,
		private readonly machineTrustService: MachineTrustService,
		private readonly machineRegistrationService: MachineRegistrationService
	) {}

	@Post('register')
	@HttpCode(HttpStatus.OK)
	@AllowAuthMethods([AuthMethod.SESSION])
	@RequiredOrganizationPermissions({ machines: ['write'] })
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('machine-register')
	@ApiOperation({
		summary:
			'Register this machine as a machine owned by the active organization of the signed-in session; repeating it with the same identity key returns the same machine',
		operationId: 'registerMachine',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineRegistrationDto })
	@Audit({
		action: AuditAction.REGISTER,
		targetType: AuditTarget.MACHINE,
		targetIdFromResult: (result: MachineRegistrationDto) => result.machineId,
		requestMetadata: {
			body: (request: TypedRequest<RegisterMachineDto>) => ({
				name: request.body?.name,
			}),
		},
	})
	register(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: RegisterMachineDto,
		@Req() request: Request
	): Promise<MachineRegistrationDto> {
		return this.machineRegistrationService.register(
			authContext.organizationId,
			input,
			request.ip
		);
	}

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
	@ApiResponse({ status: HttpStatus.OK, type: MachineDto })
	@UseGuards(MachineAccessGuard)
	@RequiredOrganizationPermissions({ machines: ['read'] })
	async getMachineById(
		@Param('id', ParseUUIDPipe) id: string
	): Promise<MachineDto> {
		return MachineDto.from(await this.machineService.findOneOrFail(id));
	}

	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'List all machines', operationId: 'listMachines' })
	@ApiResponse({ status: HttpStatus.OK, type: MachinePageDto })
	@RequiredOrganizationPermissions({ machines: ['read'] })
	async findAll(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: MachineListQueryDto
	): Promise<MachinePageDto> {
		return this.machineDirectory.findAllByOrganization(
			authContext.organizationId,
			query.limit,
			query.cursor,
			query.location
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
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update machine draining status',
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
			await this.machineAdministration.updateDrainingStatus(id, body.draining)
		);
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
