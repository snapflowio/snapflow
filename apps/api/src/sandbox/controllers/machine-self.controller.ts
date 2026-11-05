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
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { IsMachineAuthContext } from '../../common/decorators/auth-context.decorator';
import { CursorPageQueryDto } from '../../common/dto/cursor-page.dto';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { MachineAuthContext } from '../../common/types/machine-auth-context.types';
import { ActiveMachineSession } from '../../machine/decorators/machine-session.decorator';
import { MachineDto } from '../../machine/dto/machine.dto';
import { MachineControlPolicyDto } from '../../machine/dto/machine-control-policy.dto';
import { MachineFullDto } from '../../machine/dto/machine-full.dto';
import { MachineHealthcheckDto } from '../../machine/dto/machine-health.dto';
import { MachineUpdateStatusDto } from '../../machine/dto/machine-update-status.dto';
import {
	AcceptedMachineUsageReceiptDto,
	MachineReportablePlacementPageDto,
	MachineUsageReceiptDto,
} from '../../machine/dto/machine-usage.dto';
import type { MachineSession } from '../../machine/entities/machine-session.entity';
import { MachineSessionGuard } from '../../machine/guards/machine-session.guard';
import { MachineService } from '../../machine/services/machine.service';
import { MachineAdministrationService } from '../../machine/services/machine-administration.service';
import { MachineControlPolicyService } from '../../machine/services/machine-control-policy.service';
import { MachineDirectoryService } from '../../machine/services/machine-directory.service';
import { MachineHealthService } from '../../machine/services/machine-health.service';
import { MachineUsageService } from '../../machine/services/machine-usage.service';
import { MachineQualificationService } from '../../machine/services/qualification/machine-qualification.service';
import { MachineCapacityService } from '../../placement/services/machine-capacity.service';
import { SnapshotPrewarmService } from '../../snapshot/services/snapshot-prewarm.service';

@Controller('machines')
@ApiTags('machines')
@PublicEndpoint()
@UseGuards(MachineSessionGuard, AuthenticatedRateLimitGuard)
export class MachineSelfController {
	constructor(
		private readonly machineService: MachineService,
		private readonly machineDirectory: MachineDirectoryService,
		private readonly machineAdministration: MachineAdministrationService,
		private readonly machineHealthService: MachineHealthService,
		private readonly machineCapacityService: MachineCapacityService,
		private readonly machineUsageService: MachineUsageService,
		private readonly machineControlPolicyService: MachineControlPolicyService,
		private readonly machineQualificationService: MachineQualificationService,
		private readonly snapshotPrewarmService: SnapshotPrewarmService
	) {}

	@Get('control-policy')
	@ApiOperation({
		summary: 'Get the authenticated machine control policy',
		operationId: 'getMachineControlPolicy',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineControlPolicyDto })
	getControlPolicy(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession
	): Promise<MachineControlPolicyDto> {
		return this.machineControlPolicyService.current(
			machineContext.machineId,
			session
		);
	}

	@Get('usage/placements')
	@ApiOperation({
		summary: 'List active and recently released placements for usage evidence',
		operationId: 'listMachineUsagePlacements',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: MachineReportablePlacementPageDto,
	})
	listUsagePlacements(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Query() query: CursorPageQueryDto
	): Promise<MachineReportablePlacementPageDto> {
		return this.machineUsageService.listReportablePlacements(
			machineContext.machineId,
			query.limit,
			query.cursor
		);
	}

	@Post('usage/receipts')
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({
		summary: 'Submit signed cumulative usage evidence for a placement',
		operationId: 'submitMachineUsageReceipt',
	})
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		type: AcceptedMachineUsageReceiptDto,
	})
	submitUsageReceipt(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Body() input: MachineUsageReceiptDto
	): Promise<AcceptedMachineUsageReceiptDto> {
		return this.machineUsageService.record(
			machineContext.machineId,
			session,
			input
		);
	}

	@Get('me')
	@ApiOperation({
		summary: 'Get info for authenticated machine',
		operationId: 'getInfoForAuthenticatedMachine',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineFullDto })
	getInfo(
		@IsMachineAuthContext() machineContext: MachineAuthContext
	): Promise<MachineFullDto> {
		return this.machineDirectory.findOneFullOrFail(machineContext.machineId);
	}

	@Patch('me/update-drain')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			'Stop new placements and drain the authenticated machine for update',
		operationId: 'requestAuthenticatedMachineUpdateDrain',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineDto })
	async requestUpdateDrain(
		@IsMachineAuthContext() machineContext: MachineAuthContext
	): Promise<MachineDto> {
		return MachineDto.from(
			await this.machineAdministration.requestUpdateDrain(
				machineContext.machineId
			)
		);
	}

	@Patch('me/update-status')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Publish the authenticated machine update transaction status',
		operationId: 'reportAuthenticatedMachineUpdateStatus',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineDto })
	async reportUpdateStatus(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Body() status: MachineUpdateStatusDto
	): Promise<MachineDto> {
		return MachineDto.from(
			await this.machineAdministration.reportUpdateStatus(
				machineContext.machineId,
				status
			)
		);
	}

	@Post('healthcheck')
	@ApiOperation({
		summary: 'Publish machine health, readiness, and resource metrics',
		operationId: 'machineHealthcheck',
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Healthcheck received' })
	async healthcheck(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Body() healthcheck: MachineHealthcheckDto
	): Promise<void> {
		await this.machineHealthService.updateMachineHealth(
			machineContext.machineId,
			healthcheck
		);
		await this.machineCapacityService.recordObservation(
			await this.machineService.findOneOrFail(machineContext.machineId),
			session
		);
		await this.machineQualificationService.ensureChallenge(
			machineContext.machineId,
			session
		);
		await this.snapshotPrewarmService.reconcile(machineContext.machineId);
	}
}
