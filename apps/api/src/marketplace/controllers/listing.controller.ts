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
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { ListingPageDto, MachineDetailDto } from '../dto/machine.dto';
import {
	ListListingsQueryDto,
	MachineShapeQueryDto,
} from '../dto/machine-browse-query.dto';
import { MachineBrowseService } from '../services/machine-browse.service';

@Controller('listings')
@ApiTags('listings')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class ListingController {
	constructor(private readonly browse: MachineBrowseService) {}

	@Get()
	@ApiOperation({
		summary: 'Browse machines priced all-in for a sandbox shape',
		operationId: 'listListings',
	})
	@ApiResponse({ status: HttpStatus.OK, type: ListingPageDto })
	listListings(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Query() query: ListListingsQueryDto,
		@Req() request: Request
	): Promise<ListingPageDto> {
		return this.browse.list(query, context.organizationId, request.ip);
	}

	@Get(':machineId')
	@ApiOperation({
		summary: 'Get a machine with its measured specs and price breakdown',
		operationId: 'getListing',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineDetailDto })
	getListing(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string,
		@Query() query: MachineShapeQueryDto
	): Promise<MachineDetailDto> {
		return this.browse.get(machineId, query, context.organizationId);
	}
}
