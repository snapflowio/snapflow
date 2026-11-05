/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { enabledSocialProviders } from '../../auth/better-auth/plugins/social-providers';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { AnonymousRateLimitGuard } from '../../common/guards/anonymous-rate-limit.guard';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { AvailableInMaintenance } from '../../settings/guards/maintenance.guard';
import { PublicConfigDto } from '../dto/public-config.dto';

@Controller('public-config')
@ApiTags('public-config')
@PublicEndpoint()
@AvailableInMaintenance()
@UseGuards(AnonymousRateLimitGuard)
export class PublicConfigController {
	constructor(private readonly config: TypedConfigService) {}

	@Get()
	@ApiOperation({
		summary: 'Get the public configuration of the dashboard',
		operationId: 'getPublicConfig',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PublicConfigDto })
	get(): PublicConfigDto {
		return {
			websiteUrl: this.config.getOrThrow('websiteUrl'),
			socialProviders: enabledSocialProviders(this.config),
			settlement: {
				chainId: this.config.get('settlement.chainId'),
				escrowAddress: this.config.get('settlement.escrowAddress'),
				usdcAddress: this.config.get('settlement.usdcAddress'),
			},
		};
	}
}
