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
	Headers,
	HttpCode,
	HttpStatus,
	Post,
	Query,
	Res,
	UseGuards,
} from '@nestjs/common';
import {
	ApiHeader,
	ApiOperation,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { IsMachineAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { MachineAuthContext } from '../../common/types/machine-auth-context.types';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import {
	CONTROL_DOCUMENT_WAIT_QUERY,
	sendControlDocument,
} from '../../infra/control-wake/utils/control-document-long-poll.util';
import { ActiveMachineSession } from '../../sandbox/machine/decorators/machine-session.decorator';
import type { MachineSession } from '../../sandbox/machine/entities/machine-session.entity';
import { MachineSessionGuard } from '../../sandbox/machine/guards/machine-session.guard';
import { NETWORK_WAKE_TOPIC } from '../constants/networking.constants';
import {
	IssueMachineTunnelCertificateDto,
	MachineTunnelCertificateDto,
} from '../dto/machine-tunnel-certificate.dto';
import {
	MachineTunnelBindingAcknowledgementDto,
	MachineTunnelBindingAcknowledgementResponseDto,
	MachineTunnelTargetPlanAcknowledgementDto,
	MachineTunnelTargetPlanAcknowledgementResponseDto,
} from '../dto/machine-tunnel-observation.dto';
import { MachineTunnelPlanDto } from '../dto/machine-tunnel-plan.dto';
import { MachineTunnelCertificateService } from '../services/machine-tunnel/machine-tunnel-certificate.service';
import { MachineTunnelObservationService } from '../services/machine-tunnel/machine-tunnel-observation.service';
import { MachineTunnelPlanService } from '../services/machine-tunnel/machine-tunnel-plan.service';

const IF_NONE_MATCH_HEADER = 'if-none-match';

@Controller('machines/tunnels')
@ApiTags('machine-tunnel-control')
@PublicEndpoint()
@UseGuards(MachineSessionGuard, AuthenticatedRateLimitGuard)
export class MachineTunnelController {
	constructor(
		private readonly plans: MachineTunnelPlanService,
		private readonly observations: MachineTunnelObservationService,
		private readonly certificates: MachineTunnelCertificateService,
		private readonly wakes: ControlWakeService
	) {}

	@Post('certificates')
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Issue a binding-fenced machine tunnel workload certificate',
		operationId: 'issueMachineTunnelCertificate',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		type: MachineTunnelCertificateDto,
	})
	issueCertificate(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Body() input: IssueMachineTunnelCertificateDto
	): Promise<MachineTunnelCertificateDto> {
		return this.certificates.issue(machineContext.machineId, session, input);
	}

	@Post('acknowledgements')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Acknowledge an established binding-fenced tunnel connection',
		operationId: 'acknowledgeMachineTunnelBinding',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: MachineTunnelBindingAcknowledgementResponseDto,
	})
	acknowledge(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Body() input: MachineTunnelBindingAcknowledgementDto
	): Promise<MachineTunnelBindingAcknowledgementResponseDto> {
		return this.observations.acknowledge(
			machineContext.machineId,
			session,
			input
		);
	}

	@Post('target-plan-acknowledgements')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Acknowledge an atomically installed machine tunnel target plan',
		operationId: 'acknowledgeMachineTunnelTargetPlan',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: MachineTunnelTargetPlanAcknowledgementResponseDto,
	})
	acknowledgeTargetPlan(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Body() input: MachineTunnelTargetPlanAcknowledgementDto
	): Promise<MachineTunnelTargetPlanAcknowledgementResponseDto> {
		return this.observations.acknowledgeTargetPlan(
			machineContext.machineId,
			session,
			input
		);
	}

	@Get('plan')
	@ApiHeader({
		name: 'If-None-Match',
		description: 'Previously installed tunnel-plan digest',
		required: false,
	})
	@ApiOperation({
		summary: 'Read the complete immutable machine tunnel plan',
		operationId: 'getMachineTunnelPlan',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineTunnelPlanDto })
	@ApiResponse({
		status: HttpStatus.NOT_MODIFIED,
		description: 'Tunnel plan is unchanged',
	})
	@ApiResponse({
		status: HttpStatus.SERVICE_UNAVAILABLE,
		description: 'The API is shutting down; retry after the advertised delay',
	})
	@ApiQuery(CONTROL_DOCUMENT_WAIT_QUERY)
	getPlan(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Headers(IF_NONE_MATCH_HEADER) ifNoneMatch: string | undefined,
		@Query(CONTROL_DOCUMENT_WAIT_QUERY.name)
		requestedWaitSeconds: string | undefined,
		@Res() response: Response
	): Promise<void> {
		return sendControlDocument(response, {
			wakes: this.wakes,
			topic: NETWORK_WAKE_TOPIC.MACHINE_TUNNEL_PLAN,
			subjectId: machineContext.machineId,
			ifNoneMatch,
			requestedWaitSeconds,
			unavailableMessage:
				'Machine tunnel plan polling is temporarily unavailable',
			build: () => this.plans.build(machineContext.machineId, session),
		});
	}
}
