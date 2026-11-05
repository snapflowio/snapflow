/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { EDGE_SESSION_HEADER } from '../../networking/constants/edge.constants';
import { EdgeSessionGuard } from '../../networking/guards/edge-session.guard';
import { SpeedtestTokenKeyDto } from '../dto/speedtest-token.dto';
import { SpeedtestTokenService } from '../services/speedtest-token.service';

@Controller('edge')
@ApiTags('edge-control')
export class EdgeSpeedtestController {
	constructor(private readonly tokens: SpeedtestTokenService) {}

	@Get('speedtest-token-keys')
	@PublicEndpoint()
	@UseGuards(EdgeSessionGuard)
	@ApiHeader({ name: EDGE_SESSION_HEADER.id, required: true })
	@ApiHeader({ name: EDGE_SESSION_HEADER.token, required: true })
	@ApiOperation({
		summary: 'List the keys that sign benchmark speedtest tokens',
		operationId: 'listEdgeSpeedtestTokenKeys',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: SpeedtestTokenKeyDto,
		isArray: true,
	})
	listEdgeSpeedtestTokenKeys(): SpeedtestTokenKeyDto[] {
		return this.tokens.publicKeys();
	}
}
