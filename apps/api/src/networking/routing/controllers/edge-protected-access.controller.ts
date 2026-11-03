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
	HttpCode,
	HttpStatus,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicEndpoint } from '../../../auth/decorators/public-endpoint.decorator';
import { EDGE_SESSION_HEADER } from '../constants/edge.constants';
import { ActiveEdgeSession } from '../decorators/edge-session.decorator';
import {
	ProtectedAccessGrantRedemptionDto,
	RedeemProtectedAccessGrantDto,
} from '../dto/protected-access.dto';
import type { EdgeSession } from '../entities/edge-session.entity';
import { EdgeSessionGuard } from '../guards/edge-session.guard';
import { ProtectedAccessGrantService } from '../services/protected-access/protected-access-grant.service';

@Controller('edge/protected-access')
@ApiTags('edge-control')
export class EdgeProtectedAccessController {
	constructor(private readonly grants: ProtectedAccessGrantService) {}

	@Post('redeem')
	@HttpCode(HttpStatus.OK)
	@PublicEndpoint()
	@UseGuards(EdgeSessionGuard)
	@ApiHeader({ name: EDGE_SESSION_HEADER.id, required: true })
	@ApiHeader({ name: EDGE_SESSION_HEADER.token, required: true })
	@ApiOperation({
		summary: 'Atomically redeem a single-use protected exposure grant',
		operationId: 'redeemProtectedAccessGrant',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: ProtectedAccessGrantRedemptionDto,
	})
	redeem(
		@ActiveEdgeSession() session: EdgeSession,
		@Body() input: RedeemProtectedAccessGrantDto
	): Promise<ProtectedAccessGrantRedemptionDto> {
		return this.grants.redeem(session, input);
	}
}
