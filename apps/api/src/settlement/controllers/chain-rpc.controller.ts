/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ThrottlerScope } from '../../common/decorators/throttler-scope.decorator';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import { TermsAcceptanceExempt } from '../../legal/decorators/terms-acceptance-exempt.decorator';
import { ChainRpcRequestDto } from '../dto/chain-rpc.dto';
import { ChainRpcProxyService } from '../services/chain/chain-rpc-proxy.service';

@Controller('settlement/rpc')
@ApiExcludeController()
@TermsAcceptanceExempt()
@ThrottlerScope(RateLimitThrottler.CHAIN_RPC)
export class ChainRpcController {
	constructor(private readonly proxy: ChainRpcProxyService) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	forward(@Body() request: ChainRpcRequestDto): Promise<unknown> {
		return this.proxy.forward(request);
	}
}
