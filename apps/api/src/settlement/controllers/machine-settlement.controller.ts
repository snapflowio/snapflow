/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Controller,
	Get,
	Headers,
	HttpStatus,
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
import { MachineSessionGuard } from '../../machine/guards/machine-session.guard';
import { SETTLEMENT_VOUCHER_WAKE_TOPIC } from '../constants/payment-channel.constants';
import { MachineVoucherRelayDto } from '../dto/machine-voucher-relay.dto';
import { MachineVoucherRelayService } from '../services/machine-voucher-relay.service';

const IF_NONE_MATCH_HEADER = 'if-none-match';

@Controller('machines/settlement')
@ApiTags('machine-settlement')
@PublicEndpoint()
@UseGuards(MachineSessionGuard, AuthenticatedRateLimitGuard)
export class MachineSettlementController {
	constructor(
		private readonly relay: MachineVoucherRelayService,
		private readonly wakes: ControlWakeService
	) {}

	@Get('vouchers')
	@ApiHeader({
		name: 'If-None-Match',
		description: 'Digest of the voucher document the machine holds',
		required: false,
	})
	@ApiOperation({
		summary:
			'Read the latest signed vouchers paying for the sandboxes on the machine',
		operationId: 'getMachineVouchers',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineVoucherRelayDto })
	@ApiResponse({
		status: HttpStatus.NOT_MODIFIED,
		description: 'No voucher changed',
	})
	@ApiResponse({
		status: HttpStatus.SERVICE_UNAVAILABLE,
		description: 'The API is shutting down; retry after the advertised delay',
	})
	@ApiQuery(CONTROL_DOCUMENT_WAIT_QUERY)
	getVouchers(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Headers(IF_NONE_MATCH_HEADER) ifNoneMatch: string | undefined,
		@Query(CONTROL_DOCUMENT_WAIT_QUERY.name)
		requestedWaitSeconds: string | undefined,
		@Res() response: Response
	): Promise<void> {
		return sendControlDocument(response, {
			wakes: this.wakes,
			topic: SETTLEMENT_VOUCHER_WAKE_TOPIC,
			subjectId: machineContext.machineId,
			ifNoneMatch,
			requestedWaitSeconds,
			unavailableMessage: 'Machine voucher polling is temporarily unavailable',
			build: () => this.relay.build(machineContext.machineId),
		});
	}
}
