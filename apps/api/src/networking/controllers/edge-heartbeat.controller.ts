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
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { EDGE_SESSION_HEADER } from '../constants/edge.constants';
import { ActiveEdgeSession } from '../decorators/edge-session.decorator';
import {
	EdgeHeartbeatDto,
	EdgeHeartbeatResponseDto,
} from '../dto/edge-heartbeat.dto';
import type { EdgeSession } from '../entities/edge-session.entity';
import { EdgeSessionGuard } from '../guards/edge-session.guard';
import { EdgeHeartbeatService } from '../services/edge/edge-heartbeat.service';

@Controller('edge')
@ApiTags('edge-control')
export class EdgeHeartbeatController {
	constructor(private readonly heartbeatService: EdgeHeartbeatService) {}

	@Post('heartbeat')
	@HttpCode(HttpStatus.OK)
	@PublicEndpoint()
	@UseGuards(EdgeSessionGuard)
	@ApiHeader({
		name: EDGE_SESSION_HEADER.id,
		description: 'Identifies the active short-lived Edge session',
		required: true,
	})
	@ApiHeader({
		name: EDGE_SESSION_HEADER.token,
		description: 'Proves ownership of the active short-lived Edge session',
		required: true,
	})
	@ApiOperation({
		summary: 'Record Edge listener, capacity, and binding observations',
		operationId: 'reportEdgeHeartbeat',
	})
	@ApiResponse({ status: HttpStatus.OK, type: EdgeHeartbeatResponseDto })
	record(
		@ActiveEdgeSession() session: EdgeSession,
		@Body() input: EdgeHeartbeatDto
	): Promise<EdgeHeartbeatResponseDto> {
		return this.heartbeatService.record(session, input);
	}
}
