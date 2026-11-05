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
import { Throttle } from '@nestjs/throttler';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { EDGE_SESSION_HEADER } from '../constants/edge.constants';
import { NETWORKING_THROTTLE } from '../constants/networking.constants';
import { ActiveEdgeSession } from '../decorators/edge-session.decorator';
import {
	CompleteEdgeEnrollmentDto,
	CreateEdgeSessionDto,
	EdgeEnrollmentDto,
	EdgeSessionDto,
	RenewEdgeSessionDto,
} from '../dto/edge-identity.dto';
import type { EdgeSession } from '../entities/edge-session.entity';
import { EdgeSessionGuard } from '../guards/edge-session.guard';
import { EdgeEnrollmentService } from '../services/edge/edge-enrollment.service';
import { EdgeSessionService } from '../services/edge/edge-session.service';

@Controller('edge')
@ApiTags('edge-control')
export class EdgeIdentityController {
	constructor(
		private readonly enrollmentService: EdgeEnrollmentService,
		private readonly sessionService: EdgeSessionService
	) {}

	@Post('enrollment')
	@HttpCode(HttpStatus.OK)
	@PublicEndpoint()
	@Throttle({ default: NETWORKING_THROTTLE.edgeEnrollment })
	@ApiOperation({
		summary: 'Complete one-time Edge machine enrollment',
		operationId: 'completeEdgeEnrollment',
	})
	@ApiResponse({ status: HttpStatus.OK, type: EdgeEnrollmentDto })
	completeEnrollment(
		@Body() input: CompleteEdgeEnrollmentDto
	): Promise<EdgeEnrollmentDto> {
		return this.enrollmentService.complete(input);
	}

	@Post('session')
	@PublicEndpoint()
	@Throttle({ default: NETWORKING_THROTTLE.edgeSession })
	@ApiOperation({
		summary: 'Create a short-lived Edge control session',
		operationId: 'createEdgeSession',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: EdgeSessionDto })
	createSession(@Body() input: CreateEdgeSessionDto): Promise<EdgeSessionDto> {
		return this.sessionService.create(input);
	}

	@Post('session/renew')
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
		summary: 'Renew the active Edge control session',
		operationId: 'renewEdgeSession',
	})
	@ApiResponse({ status: HttpStatus.OK, type: RenewEdgeSessionDto })
	renewSession(
		@ActiveEdgeSession() session: EdgeSession
	): Promise<RenewEdgeSessionDto> {
		return this.sessionService.renew(session);
	}
}
