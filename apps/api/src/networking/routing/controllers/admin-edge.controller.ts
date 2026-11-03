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
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../../auth/decorators/allow-auth-methods.decorator';
import { CursorPageQueryDto } from '../../../common/dto/cursor-page.dto';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import { RequiredSystemRole } from '../../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../../user/enums/system-role.enum';
import {
	CreateEdgeDto,
	CreateEdgeResponseDto,
	EdgeDto,
	EdgeEnrollmentSecretDto,
	EdgePageDto,
	UpdateEdgeStatusDto,
} from '../dto/edge.dto';
import { EdgeService } from '../services/edge/edge.service';

@Controller('admin/edges')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminEdgeController {
	constructor(private readonly edgeService: EdgeService) {}

	@Post()
	@ApiOperation({
		summary: 'Create an Edge and issue its one-time enrollment secret',
		operationId: 'adminCreateEdge',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: CreateEdgeResponseDto })
	create(@Body() input: CreateEdgeDto): Promise<CreateEdgeResponseDto> {
		return this.edgeService.create(input);
	}

	@Get()
	@ApiOperation({ summary: 'List Edges', operationId: 'adminListEdges' })
	@ApiResponse({ status: HttpStatus.OK, type: EdgePageDto })
	findAll(@Query() query: CursorPageQueryDto): Promise<EdgePageDto> {
		return this.edgeService.findAll(query.limit, query.cursor);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get an Edge', operationId: 'adminGetEdge' })
	@ApiResponse({ status: HttpStatus.OK, type: EdgeDto })
	findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EdgeDto> {
		return this.edgeService.findOneDtoOrFail(id);
	}

	@Patch(':id/status')
	@ApiOperation({
		summary: 'Set Edge lifecycle status',
		operationId: 'adminUpdateEdgeStatus',
	})
	@ApiResponse({ status: HttpStatus.OK, type: EdgeDto })
	updateStatus(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() input: UpdateEdgeStatusDto
	): Promise<EdgeDto> {
		return this.edgeService.updateStatus(id, input);
	}

	@Post(':id/enrollment-secret')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Fence Edge sessions and issue a new one-time enrollment secret',
		operationId: 'adminReissueEdgeEnrollmentSecret',
	})
	@ApiResponse({ status: HttpStatus.OK, type: EdgeEnrollmentSecretDto })
	reissueEnrollmentSecret(
		@Param('id', ParseUUIDPipe) id: string
	): Promise<EdgeEnrollmentSecretDto> {
		return this.edgeService.reissueEnrollmentSecret(id);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Delete an Edge', operationId: 'adminDeleteEdge' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
		return this.edgeService.remove(id);
	}
}
