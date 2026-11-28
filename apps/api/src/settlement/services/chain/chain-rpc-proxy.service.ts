/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { SettlementErrorCode } from '../../constants/payment-channel.constants';
import { SETTLEMENT_RPC_TIMEOUT_MILLISECONDS } from '../../constants/settlement.constants';
import type { ChainRpcRequestDto } from '../../dto/chain-rpc.dto';

const JSON_CONTENT_TYPE = 'application/json';

@Injectable()
export class ChainRpcProxyService {
	private readonly logger = new Logger(ChainRpcProxyService.name);

	constructor(private readonly config: TypedConfigService) {}

	async forward({
		jsonrpc,
		id,
		method,
		params,
	}: ChainRpcRequestDto): Promise<unknown> {
		try {
			const response = await fetch(this.config.get('settlement.rpcUrl'), {
				method: 'POST',
				headers: { 'content-type': JSON_CONTENT_TYPE },
				body: JSON.stringify({ jsonrpc, id, method, params: params ?? [] }),
				signal: AbortSignal.timeout(SETTLEMENT_RPC_TIMEOUT_MILLISECONDS),
			});
			if (!response.ok) {
				await response.body?.cancel();
				throw new Error(`The settlement RPC answered HTTP ${response.status}`);
			}
			return await response.json();
		} catch (error) {
			this.logger.error(
				`Could not forward ${method} to the settlement chain`,
				error
			);
			throw new ServiceUnavailableException(
				{
					code: SettlementErrorCode.CHAIN_UNAVAILABLE,
					message: 'The settlement chain is unreachable; retry shortly',
				},
				{ cause: error }
			);
		}
	}
}
