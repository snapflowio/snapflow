/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Equals, IsArray, IsDefined, IsIn, IsOptional } from 'class-validator';
import {
	CHAIN_RPC_READ_METHODS,
	CHAIN_RPC_VERSION,
	type ChainRpcReadMethod,
} from '../constants/chain-rpc.constants';

export class ChainRpcRequestDto {
	@Equals(CHAIN_RPC_VERSION)
	jsonrpc: typeof CHAIN_RPC_VERSION;

	@IsDefined()
	id: number | string;

	@IsIn(CHAIN_RPC_READ_METHODS)
	method: ChainRpcReadMethod;

	@IsOptional()
	@IsArray()
	params?: unknown[];
}
