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
	EdgeUsageCheckpointAcknowledgementDto,
	EdgeUsageCheckpointDto,
	EdgeUsageEpochDto,
} from '../dto/edge-usage.dto';
import type { EdgeSession } from '../entities/edge-session.entity';
import { EdgeSessionGuard } from '../guards/edge-session.guard';
import { EdgeUsageService } from '../services/edge/edge-usage.service';

@Controller('edge')
@ApiTags('edge-control')
export class EdgeUsageController {
	constructor(private readonly usage: EdgeUsageService) {}

	@Post('usage-epochs')
	@HttpCode(HttpStatus.OK)
	@PublicEndpoint()
	@UseGuards(EdgeSessionGuard)
	@ApiHeader({ name: EDGE_SESSION_HEADER.id, required: true })
	@ApiHeader({ name: EDGE_SESSION_HEADER.token, required: true })
	@ApiOperation({
		summary:
			'Open a new usage epoch, closing earlier epochs and returning the digest the epoch chains to',
		operationId: 'openEdgeUsageEpoch',
	})
	@ApiResponse({ status: HttpStatus.OK, type: EdgeUsageEpochDto })
	openEpoch(
		@ActiveEdgeSession() session: EdgeSession
	): Promise<EdgeUsageEpochDto> {
		return this.usage.openEpoch(session);
	}

	@Post('usage-checkpoints')
	@HttpCode(HttpStatus.OK)
	@PublicEndpoint()
	@UseGuards(EdgeSessionGuard)
	@ApiHeader({ name: EDGE_SESSION_HEADER.id, required: true })
	@ApiHeader({ name: EDGE_SESSION_HEADER.token, required: true })
	@ApiOperation({
		summary: 'Ingest a signed, digest-chained Edge usage checkpoint',
		operationId: 'ingestEdgeUsageCheckpoint',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: EdgeUsageCheckpointAcknowledgementDto,
	})
	ingest(
		@ActiveEdgeSession() session: EdgeSession,
		@Body() input: EdgeUsageCheckpointDto
	): Promise<EdgeUsageCheckpointAcknowledgementDto> {
		return this.usage.ingest(session, input);
	}
}
