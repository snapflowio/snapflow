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
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { IsMachineAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { MachineAuthContext } from '../../common/types/machine-auth-context.types';
import { ActiveMachineSession } from '../../machine/decorators/machine-session.decorator';
import {
	MachineSnapshotInventoryReportDto,
	MachineSnapshotRegistryCredentialsDto,
} from '../../machine/dto/machine-snapshot-control.dto';
import type { MachineSession } from '../../machine/entities/machine-session.entity';
import { MachineSessionGuard } from '../../machine/guards/machine-session.guard';
import { MachineSnapshotCredentialsService } from '../../machine/services/desired-state/machine-snapshot-credentials.service';
import { MachineSnapshotInventoryService } from '../../snapshot/services/machine-snapshot-inventory.service';

@Controller('machines/snapshots')
@ApiTags('machine-snapshot-control')
@PublicEndpoint()
@UseGuards(MachineSessionGuard, AuthenticatedRateLimitGuard)
export class MachineSnapshotControlController {
	constructor(
		private readonly inventory: MachineSnapshotInventoryService,
		private readonly credentials: MachineSnapshotCredentialsService
	) {}

	@Post('observed-inventory')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Report the complete snapshot inventory of the machine',
		operationId: 'reportMachineSnapshotInventory',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	reportInventory(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Body() input: MachineSnapshotInventoryReportDto
	): Promise<void> {
		return this.inventory.report(
			machineContext.machineId,
			session,
			input.inventory
		);
	}

	@Get('registries/:registryId/credentials')
	@ApiOperation({
		summary:
			'Read the credentials of a registry a desired snapshot of the machine is pulled from',
		operationId: 'getMachineSnapshotRegistryCredentials',
	})
	@ApiParam({ name: 'registryId', description: 'ID of the registry' })
	@ApiResponse({
		status: HttpStatus.OK,
		type: MachineSnapshotRegistryCredentialsDto,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description:
			'No desired snapshot of the machine is pulled from the registry',
	})
	getRegistryCredentials(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() session: MachineSession,
		@Param('registryId', ParseUUIDPipe) registryId: string
	): Promise<MachineSnapshotRegistryCredentialsDto> {
		return this.credentials.deliver(
			machineContext.machineId,
			session,
			registryId
		);
	}
}
