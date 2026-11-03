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
	Param,
	Post,
	Query,
	Res,
	UseGuards,
} from '@nestjs/common';
import {
	ApiHeader,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PublicEndpoint } from '../../../auth/decorators/public-endpoint.decorator';
import { IsMachineAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { MachineAuthContext } from '../../../common/types/machine-auth-context.types';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import {
	CONTROL_DOCUMENT_WAIT_QUERY,
	sendControlDocument,
} from '../../../infra/control-wake/utils/control-document-long-poll.util';
import { MACHINE_DESIRED_STATE_WAKE_TOPIC } from '../../machine/constants/machine-desired-state.constants';
import { ActiveMachineSession } from '../../machine/decorators/machine-session.decorator';
import {
	MachineDesiredStateDocumentDto,
	MachineObservedStatusReportDto,
	MachineObservedStatusResultDto,
	MachineSandboxSecretsDto,
	MachineSandboxSecretsQueryDto,
} from '../../machine/dto/machine-sandbox-control.dto';
import type { MachineSession } from '../../machine/entities/machine-session.entity';
import { MachineSessionGuard } from '../../machine/guards/machine-session.guard';
import { MachineDesiredStateService } from '../../machine/services/desired-state/machine-desired-state.service';
import { MachineSandboxSecretsService } from '../../machine/services/desired-state/machine-sandbox-secrets.service';
import { SandboxObservedStatusService } from '../services/sandbox/sandbox-observed-status.service';

const IF_NONE_MATCH_HEADER = 'if-none-match';

@Controller('machines/sandboxes')
@ApiTags('machine-sandbox-control')
@PublicEndpoint()
@UseGuards(MachineSessionGuard, AuthenticatedRateLimitGuard)
export class MachineSandboxControlController {
	constructor(
		private readonly desiredState: MachineDesiredStateService,
		private readonly observedStatus: SandboxObservedStatusService,
		private readonly secrets: MachineSandboxSecretsService,
		private readonly wakes: ControlWakeService
	) {}

	@Get('desired-state')
	@ApiHeader({
		name: 'If-None-Match',
		description: 'Digest of the desired-state document the machine holds',
		required: false,
	})
	@ApiOperation({
		summary: 'Read the sandbox desired-state document of the machine',
		operationId: 'getMachineDesiredState',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineDesiredStateDocumentDto })
	@ApiResponse({
		status: HttpStatus.NOT_MODIFIED,
		description: 'The desired state is unchanged',
	})
	@ApiResponse({
		status: HttpStatus.SERVICE_UNAVAILABLE,
		description: 'The API is shutting down; retry after the advertised delay',
	})
	@ApiQuery(CONTROL_DOCUMENT_WAIT_QUERY)
	getDesiredState(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Headers(IF_NONE_MATCH_HEADER) ifNoneMatch: string | undefined,
		@Query(CONTROL_DOCUMENT_WAIT_QUERY.name)
		requestedWaitSeconds: string | undefined,
		@Res() response: Response
	): Promise<void> {
		return sendControlDocument(response, {
			wakes: this.wakes,
			topic: MACHINE_DESIRED_STATE_WAKE_TOPIC,
			subjectId: machineContext.machineId,
			ifNoneMatch,
			requestedWaitSeconds,
			unavailableMessage:
				'Machine desired-state polling is temporarily unavailable',
			build: () => this.desiredState.build(machineContext.machineId, session),
		});
	}

	@Post('observed-status')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Report the observed status of the sandboxes on the machine',
		operationId: 'reportMachineObservedStatus',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineObservedStatusResultDto })
	reportObservedStatus(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Body() input: MachineObservedStatusReportDto
	): Promise<MachineObservedStatusResultDto> {
		return this.observedStatus.report(
			machineContext.machineId,
			session,
			input.report
		);
	}

	@Get(':sandboxId/secrets')
	@ApiOperation({
		summary: 'Read the secrets of the sandbox generation the machine converges',
		operationId: 'getMachineSandboxSecrets',
	})
	@ApiParam({ name: 'sandboxId', description: 'ID of the sandbox' })
	@ApiResponse({ status: HttpStatus.OK, type: MachineSandboxSecretsDto })
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description: 'The assignment or spec generation is not current',
	})
	getSecrets(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Param('sandboxId') sandboxId: string,
		@Query() query: MachineSandboxSecretsQueryDto
	): Promise<MachineSandboxSecretsDto> {
		return this.secrets.deliver(
			machineContext.machineId,
			session,
			sandboxId,
			query
		);
	}
}
