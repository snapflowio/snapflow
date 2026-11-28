/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, Header, HttpStatus } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { SessionGuarded } from '../../common/decorators/session-guarded.decorator';
import { EDGE_SESSION_HEADER } from '../constants/edge.constants';
import { EdgeTlsBundleDto } from '../dto/edge-tls-bundle.dto';
import { EdgeSessionGuard } from '../guards/edge-session.guard';
import { EdgeTlsBundleService } from '../services/edge/edge-tls-bundle.service';

const CACHE_CONTROL_HEADER = 'Cache-Control';
const NO_STORE = 'no-store';

@Controller('edge')
@ApiTags(OpenApiTag.EDGE_CONTROL)
export class EdgeTlsController {
	constructor(private readonly bundles: EdgeTlsBundleService) {}

	@Get('tls')
	@PublicEndpoint()
	@SessionGuarded(EdgeSessionGuard)
	@Header(CACHE_CONTROL_HEADER, NO_STORE)
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
		summary: 'Read the TLS identity and trust anchors this edge serves with',
		operationId: 'getEdgeTlsBundle',
	})
	@ApiResponse({ status: HttpStatus.OK, type: EdgeTlsBundleDto })
	@ApiResponse({
		status: HttpStatus.SERVICE_UNAVAILABLE,
		description: 'The TLS material is not readable yet',
	})
	read(): Promise<EdgeTlsBundleDto> {
		return this.bundles.read();
	}
}
