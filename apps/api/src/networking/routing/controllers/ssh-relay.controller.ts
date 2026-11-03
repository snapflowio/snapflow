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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicEndpoint } from '../../../auth/decorators/public-endpoint.decorator';
import { IsMachineAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { MachineAuthContext } from '../../../common/types/machine-auth-context.types';
import { MachineSessionGuard } from '../../../sandbox/machine/guards/machine-session.guard';
import { MachineSshAccessDto, ResolveSshRelayDto } from '../dto/ssh-relay.dto';
import { SshRelayService } from '../services/ssh-relay.service';

@Controller('sandbox/ssh-access')
@ApiTags('machine-tunnel-control')
@PublicEndpoint()
@UseGuards(MachineSessionGuard, AuthenticatedRateLimitGuard)
export class SshRelayController {
	constructor(private readonly relays: SshRelayService) {}

	@Post('relay')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Validate an Edge SSH access grant for its assigned machine',
		operationId: 'resolveSshAccessRelay',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineSshAccessDto })
	resolve(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Body() input: ResolveSshRelayDto
	): Promise<MachineSshAccessDto> {
		return this.relays.resolveForMachine(input.token, machineContext.machineId);
	}
}
