/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import {
	ListNetworkUsageQueryDto,
	NetworkUsagePeriodDto,
	NetworkUsagePeriodPageDto,
} from '../dto/network-usage.dto';
import { NetworkUsageService } from '../services/network-usage.service';

@Controller('networking/usage')
@ApiTags('usage')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class NetworkUsageController {
	constructor(private readonly usage: NetworkUsageService) {}

	@Get('customer')
	@ApiOperation({
		summary:
			'List hourly network usage of the organization sandboxes with the egress charged',
		operationId: 'listCustomerNetworkUsage',
	})
	@ApiResponse({ status: HttpStatus.OK, type: NetworkUsagePeriodPageDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	async listCustomerNetworkUsage(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListNetworkUsageQueryDto
	): Promise<NetworkUsagePeriodPageDto> {
		const page = await this.usage.customerPeriods(
			authContext.organizationId,
			query
		);
		const names = await this.usage.sandboxNames(
			authContext.organizationId,
			page.items.map((period) => period.sandboxId)
		);
		return {
			...page,
			items: page.items.map((period) =>
				NetworkUsagePeriodDto.from(period, names.get(period.sandboxId))
			),
		};
	}

	@Get('host')
	@ApiOperation({
		summary:
			'List hourly network usage carried by the machines of the organization with the egress earned',
		operationId: 'listHostNetworkUsage',
	})
	@ApiResponse({ status: HttpStatus.OK, type: NetworkUsagePeriodPageDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	async listHostNetworkUsage(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListNetworkUsageQueryDto
	): Promise<NetworkUsagePeriodPageDto> {
		const page = await this.usage.hostPeriods(
			authContext.organizationId,
			query
		);
		return {
			...page,
			items: page.items.map((period) => NetworkUsagePeriodDto.from(period)),
		};
	}
}
