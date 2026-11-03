/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicEndpoint } from '../../../auth/decorators/public-endpoint.decorator';
import { RegistryJsonWebKeySetDto } from '../dto/registry-jwks.dto';
import { RegistryTokenSigner } from '../services/registry-token-signer.service';

@Controller('registry-tokens')
@ApiTags('docker-registry')
export class RegistryTokenKeysController {
	constructor(private readonly signer: RegistryTokenSigner) {}

	@Get('jwks')
	@PublicEndpoint()
	@ApiOperation({
		summary: 'Public keys that verify registry tokens',
		operationId: 'getRegistryTokenKeys',
	})
	@ApiResponse({ status: HttpStatus.OK, type: RegistryJsonWebKeySetDto })
	keys(): Promise<RegistryJsonWebKeySetDto> {
		return this.signer.keySet();
	}
}
