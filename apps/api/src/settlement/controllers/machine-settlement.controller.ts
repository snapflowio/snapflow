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
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsMachineAuthContext } from '../../common/decorators/auth-context.decorator';
import { SessionGuarded } from '../../common/decorators/session-guarded.decorator';
import type { MachineAuthContext } from '../../common/types/machine-auth-context.types';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import {
	CONTROL_DOCUMENT_WAIT_QUERY,
	sendControlDocument,
} from '../../infra/control-wake/utils/control-document-long-poll.util';
import { RefuseSanctionedRegions } from '../../location/decorators/refuse-sanctioned-regions.decorator';
import { MachineSessionGuard } from '../../machine/guards/machine-session.guard';
import { SETTLEMENT_WAKE_TOPIC } from '../constants/payment-channel.constants';
import {
	HostSettlementDto,
	SettleMachineChannelsDto,
} from '../dto/host-settlement.dto';
import { MachineSettlementDocumentDto } from '../dto/machine-settlement.dto';
import { MachineSettlementService } from '../services/machine-settlement.service';
import { HostSettlementService } from '../services/settlements/host-settlement.service';

const IF_NONE_MATCH_HEADER = 'if-none-match';

@Controller('machines/settlement/v4')
@ApiTags(OpenApiTag.MACHINE_SETTLEMENT)
@PublicEndpoint()
@SessionGuarded(MachineSessionGuard)
export class MachineSettlementController {
	constructor(
		private readonly settlement: MachineSettlementService,
		private readonly settlements: HostSettlementService,
		private readonly wakes: ControlWakeService
	) {}

	@Get('channels')
	@ApiHeader({
		name: 'If-None-Match',
		description: 'Digest of the settlement document the machine holds',
		required: false,
	})
	@ApiOperation({
		summary:
			"Read the payment channels paying the machine's host key, with their terms, latest signed voucher and deadlines, and the relayer's fee quote",
		operationId: 'getMachineSettlementChannels',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineSettlementDocumentDto })
	@ApiResponse({
		status: HttpStatus.NOT_MODIFIED,
		description: 'Nothing changed',
	})
	@ApiResponse({
		status: HttpStatus.SERVICE_UNAVAILABLE,
		description: 'The API is shutting down; retry after the advertised delay',
	})
	@ApiQuery(CONTROL_DOCUMENT_WAIT_QUERY)
	getChannels(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Headers(IF_NONE_MATCH_HEADER) ifNoneMatch: string | undefined,
		@Query(CONTROL_DOCUMENT_WAIT_QUERY.name)
		requestedWaitSeconds: string | undefined,
		@Res() response: Response
	): Promise<void> {
		return sendControlDocument(response, {
			wakes: this.wakes,
			topic: SETTLEMENT_WAKE_TOPIC,
			subjectId: machineContext.machineId,
			ifNoneMatch,
			requestedWaitSeconds,
			unavailableMessage:
				'Machine settlement polling is temporarily unavailable',
			build: () => this.settlement.document(machineContext.machine),
		});
	}

	@Post('settlements')
	@RefuseSanctionedRegions()
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({
		summary:
			"Submit the host key's EIP-712 HostWithdrawal with the channels to claim; Snapflow's relayer sends claimBatchAndWithdraw and is repaid the relay fee",
		operationId: 'settleMachineChannels',
	})
	@ApiResponse({ status: HttpStatus.ACCEPTED, type: HostSettlementDto })
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description:
			'No host key or payout wallet, a payout other than the payout wallet, a channel with nothing to claim, a stale nonce or a settlement still in flight',
	})
	@ApiResponse({
		status: HttpStatus.UNPROCESSABLE_ENTITY,
		description:
			'The deadline is out of range, the signature does not recover to the host key, the escrow would refuse the call or the relay fee does not cover the gas',
	})
	@ApiResponse({
		status: HttpStatus.SERVICE_UNAVAILABLE,
		description: 'The settlement chain is unreachable',
	})
	settle(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Body() input: SettleMachineChannelsDto
	): Promise<HostSettlementDto> {
		return this.settlements.settle(machineContext.machine, input);
	}
}
