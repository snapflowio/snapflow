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
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import {
	CONTROL_DOCUMENT_WAIT_QUERY,
	sendControlDocument,
} from '../../infra/control-wake/utils/control-document-long-poll.util';
import { EDGE_SESSION_HEADER } from '../constants/edge.constants';
import { NETWORK_WAKE_TOPIC } from '../constants/networking.constants';
import { ActiveEdgeSession } from '../decorators/edge-session.decorator';
import { EdgeRouteSnapshotDto } from '../dto/edge-route-snapshot.dto';
import type { EdgeSession } from '../entities/edge-session.entity';
import { EdgeSessionGuard } from '../guards/edge-session.guard';
import { EdgeRouteSnapshotService } from '../services/edge/edge-route-snapshot.service';

const IF_NONE_MATCH_HEADER = 'if-none-match';

@Controller('edge')
@ApiTags('edge-control')
export class EdgeRouteController {
	constructor(
		private readonly routeSnapshotService: EdgeRouteSnapshotService,
		private readonly wakes: ControlWakeService
	) {}

	@Get('routes')
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
	@ApiHeader({
		name: 'If-None-Match',
		description: 'Previously installed route snapshot digest',
		required: false,
	})
	@ApiOperation({
		summary: 'Read the complete immutable Edge route snapshot',
		operationId: 'getEdgeRouteSnapshot',
	})
	@ApiResponse({ status: HttpStatus.OK, type: EdgeRouteSnapshotDto })
	@ApiResponse({
		status: HttpStatus.NOT_MODIFIED,
		description: 'Route snapshot is unchanged',
	})
	@ApiResponse({
		status: HttpStatus.SERVICE_UNAVAILABLE,
		description: 'The API is shutting down; retry after the advertised delay',
	})
	@ApiQuery(CONTROL_DOCUMENT_WAIT_QUERY)
	getRouteSnapshot(
		@ActiveEdgeSession() session: EdgeSession,
		@Headers(IF_NONE_MATCH_HEADER) ifNoneMatch: string | undefined,
		@Query(CONTROL_DOCUMENT_WAIT_QUERY.name)
		requestedWaitSeconds: string | undefined,
		@Res() response: Response
	): Promise<void> {
		return sendControlDocument(response, {
			wakes: this.wakes,
			topic: NETWORK_WAKE_TOPIC.EDGE_ROUTES,
			subjectId: session.edgeId,
			ifNoneMatch,
			requestedWaitSeconds,
			unavailableMessage: 'Edge route polling is temporarily unavailable',
			build: () => this.routeSnapshotService.build(session),
		});
	}
}
