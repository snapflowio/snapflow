/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { MARKETPLACE_ROUTE } from '../constants/marketplace.constants';
import { UnmetDemandDto } from '../dto/unmet-demand.dto';
import { UnmetDemandService } from '../services/unmet-demand.service';

@Controller(MARKETPLACE_ROUTE.HOST_DEMAND)
@ApiTags(OpenApiTag.HOST_PROFILE)
@ApiBearerAuth()
export class HostDemandController {
	constructor(private readonly demand: UnmetDemandService) {}

	@Get()
	@ApiOperation({
		summary:
			'List the machine types and regions customers asked for in the last week but could not get',
		operationId: 'listUnmetDemand',
	})
	@ApiResponse({ status: HttpStatus.OK, type: UnmetDemandDto, isArray: true })
	@RequiredOrganizationPermissions({ listings: ['read'] })
	list(): Promise<UnmetDemandDto[]> {
		return this.demand.summary();
	}
}
