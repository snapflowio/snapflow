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
	Post,
	Req,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { AnonymousRateLimitGuard } from '../../common/guards/anonymous-rate-limit.guard';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import { PayoutReadinessService } from '../../settlement/services/payout-readiness.service';
import { ActiveMachineSession } from '../decorators/machine-session.decorator';
import { MachineIdentityStatusDto } from '../dto/machine-identity-status.dto';
import {
	CreateMachineSessionDto,
	MachineSessionDto,
	RenewMachineSessionDto,
} from '../dto/machine-session.dto';
import type { MachineSession } from '../entities/machine-session.entity';
import { MachineSessionGuard } from '../guards/machine-session.guard';
import { MachineService } from '../services/machine.service';
import { MachineDirectoryService } from '../services/machine-directory.service';
import { MachineProofService } from '../services/machine-proof.service';
import { MachineSessionService } from '../services/machine-session.service';

@Controller('machines')
@ApiTags('machines')
@PublicEndpoint()
@UseGuards(AnonymousRateLimitGuard)
export class MachineSessionController {
	constructor(
		private readonly machineService: MachineService,
		private readonly machineDirectory: MachineDirectoryService,
		private readonly machineSessionService: MachineSessionService,
		private readonly machineProofService: MachineProofService,
		private readonly payoutReadiness: PayoutReadinessService
	) {}

	@Post('session')
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a short-lived machine session',
		operationId: 'createMachineSession',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: MachineSessionDto })
	async create(
		@Body() input: CreateMachineSessionDto,
		@Req() request: Request
	): Promise<MachineSessionDto> {
		return this.machineSessionService.create(input.machineId, request);
	}

	@Post('identity/status')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Read machine status using its enrolled machine identity',
		operationId: 'getMachineIdentityStatus',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineIdentityStatusDto })
	async status(
		@Body() input: CreateMachineSessionDto,
		@Req() request: Request
	): Promise<MachineIdentityStatusDto> {
		const machine = await this.machineService.findOneOrFail(input.machineId);
		await this.machineProofService.verify(request, machine);
		const [full, payouts] = await Promise.all([
			this.machineDirectory.toFullDto(machine),
			this.payoutReadiness.forOrganization(machine.organizationId),
		]);
		return { ...full, payouts };
	}

	@Post('session/renew')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Renew the active machine session',
		operationId: 'renewMachineSession',
	})
	@ApiResponse({ status: HttpStatus.OK, type: RenewMachineSessionDto })
	@UseGuards(MachineSessionGuard, AuthenticatedRateLimitGuard)
	async renew(
		@ActiveMachineSession() session: MachineSession
	): Promise<RenewMachineSessionDto> {
		return this.machineSessionService.renew(session);
	}

	@Delete('session')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Close the active machine session',
		operationId: 'closeMachineSession',
	})
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Machine session closed',
	})
	@UseGuards(MachineSessionGuard, AuthenticatedRateLimitGuard)
	async close(@ActiveMachineSession() session: MachineSession): Promise<void> {
		await this.machineSessionService.close(session);
	}
}
