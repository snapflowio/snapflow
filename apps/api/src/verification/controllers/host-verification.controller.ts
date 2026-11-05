/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { MARKETPLACE_ROUTE } from '../../marketplace/constants/marketplace.constants';
import { MachineMarketplaceService } from '../../marketplace/services/machine-marketplace.service';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import {
	MachineBenchmarkDto,
	MachineVerificationDto,
} from '../dto/machine-verification.dto';
import { BenchmarkTrigger } from '../enums/benchmark-trigger.enum';
import { MachineBenchmarkService } from '../services/machine-benchmark.service';
import { MachineTierService } from '../services/machine-tier.service';

@Controller(MARKETPLACE_ROUTE.HOST_MACHINES)
@ApiTags('machines')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class HostVerificationController {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machines: MachineMarketplaceService,
		private readonly tiers: MachineTierService,
		private readonly benchmarks: MachineBenchmarkService
	) {}

	@Get(':machineId/verification')
	@ApiOperation({
		summary: 'Get the verification status of a hosted machine',
		operationId: 'getMachineVerification',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineVerificationDto })
	@RequiredOrganizationPermissions({ listings: ['read'] })
	getMachineVerification(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string
	): Promise<MachineVerificationDto> {
		return this.tiers.verification(context.organizationId, machineId);
	}

	@Post(':machineId/benchmarks')
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({
		summary: 'Benchmark an idle hosted machine',
		operationId: 'requestMachineBenchmark',
	})
	@ApiResponse({ status: HttpStatus.ACCEPTED, type: MachineBenchmarkDto })
	@RequiredOrganizationPermissions({ listings: ['write'] })
	async requestMachineBenchmark(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string
	): Promise<MachineBenchmarkDto> {
		await this.machines.findOwned(
			this.entityManager.fork(),
			context.organizationId,
			machineId
		);
		return MachineBenchmarkDto.from(
			await this.benchmarks.issue(machineId, BenchmarkTrigger.HOST_REQUEST)
		);
	}
}
