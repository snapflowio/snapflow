/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus, Req, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { MachineLocationsDto } from '../dto/machine-locations.dto';
import { MachineLocationDirectoryService } from '../services/machine-location-directory.service';

@Controller('locations')
@ApiTags('listings')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class LocationController {
	constructor(private readonly locations: MachineLocationDirectoryService) {}

	@Get()
	@ApiOperation({
		summary:
			'List where the machines the organization can use are, and where the caller is',
		operationId: 'listMachineLocations',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineLocationsDto })
	list(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Req() request: Request
	): Promise<MachineLocationsDto> {
		return this.locations.list(context.organizationId, request.ip);
	}
}
