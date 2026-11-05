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
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { CursorPageQueryDto } from '../../common/dto/cursor-page.dto';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';
import { MachineListQueryDto } from '../dto/machine.dto';
import { MachineFullDto, MachineFullPageDto } from '../dto/machine-full.dto';
import {
	UpdateMachineDrainingDto,
	UpdateMachineSchedulingDto,
} from '../dto/machine-lifecycle.dto';
import {
	MachineReliabilityEventPageDto,
	MachineTrustDto,
} from '../dto/machine-trust.dto';
import { MachineAdministrationService } from '../services/machine-administration.service';
import { MachineDirectoryService } from '../services/machine-directory.service';
import { MachineTrustService } from '../services/machine-trust.service';

@Controller('admin/machines')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminMachineController {
	constructor(
		private readonly machineDirectory: MachineDirectoryService,
		private readonly machineAdministration: MachineAdministrationService,
		private readonly machineTrustService: MachineTrustService
	) {}

	@Get(':id/trust')
	@ApiOperation({
		summary: 'Get machine qualification and reliability details',
		operationId: 'adminGetMachineTrust',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineTrustDto })
	getMachineTrust(
		@Param('id', ParseUUIDPipe) id: string
	): Promise<MachineTrustDto> {
		return this.machineTrustService.getMachineTrust(id);
	}

	@Get(':id/reliability-events')
	@ApiOperation({
		summary: 'List evidence-linked machine reliability events',
		operationId: 'adminListMachineReliabilityEvents',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineReliabilityEventPageDto })
	listReliabilityEvents(
		@Param('id', ParseUUIDPipe) id: string,
		@Query() query: CursorPageQueryDto
	): Promise<MachineReliabilityEventPageDto> {
		return this.machineTrustService.listReliabilityEvents(
			id,
			query.limit,
			query.cursor
		);
	}

	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get machine by ID',
		operationId: 'adminGetMachineById',
	})
	@ApiParam({
		name: 'id',
		description: 'Machine ID',
		type: String,
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: MachineFullDto,
	})
	async getMachineById(
		@Param('id', ParseUUIDPipe) id: string
	): Promise<MachineFullDto> {
		return this.machineDirectory.findOneFullOrFail(id);
	}

	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'List all machines',
		operationId: 'adminListMachines',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: MachineFullPageDto,
	})
	async findAll(
		@Query() query: MachineListQueryDto
	): Promise<MachineFullPageDto> {
		return this.machineDirectory.findAllFull(
			query.limit,
			query.cursor,
			query.location
		);
	}

	@Patch(':id/scheduling')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Update machine scheduling status',
		operationId: 'adminUpdateMachineScheduling',
	})
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
	})
	@Audit({
		action: AuditAction.UPDATE_SCHEDULING,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: (req) => req.params.id,
		requestMetadata: {
			body: (req: TypedRequest<UpdateMachineSchedulingDto>) => ({
				unschedulable: req.body?.unschedulable,
			}),
		},
	})
	async updateSchedulingStatus(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() body: UpdateMachineSchedulingDto
	): Promise<void> {
		await this.machineAdministration.updateSchedulingStatus(
			id,
			body.unschedulable
		);
	}

	@Patch(':id/draining')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Drain a machine or return it to service',
		operationId: 'adminUpdateMachineDraining',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@Audit({
		action: AuditAction.UPDATE_DRAINING,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: (req) => req.params.id,
		requestMetadata: {
			body: (req: TypedRequest<UpdateMachineDrainingDto>) => ({
				draining: req.body?.draining,
			}),
		},
	})
	async updateDrainingStatus(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() body: UpdateMachineDrainingDto
	): Promise<void> {
		await this.machineAdministration.updateDrainingStatus(id, body.draining);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Delete machine',
		operationId: 'adminDeleteMachine',
	})
	@ApiParam({
		name: 'id',
		description: 'Machine ID',
		type: String,
	})
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
	})
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: (req) => req.params.id,
	})
	async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
		return this.machineAdministration.remove(id);
	}
}
