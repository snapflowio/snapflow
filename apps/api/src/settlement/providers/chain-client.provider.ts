/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FactoryProvider } from '@nestjs/common';
import { createPublicClient, http, type PublicClient } from 'viem';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	SETTLEMENT_CHAINS,
	SETTLEMENT_PUBLIC_CLIENT,
	SETTLEMENT_RPC_TIMEOUT_MILLISECONDS,
} from '../constants/settlement.constants';

export const chainClientProvider: FactoryProvider<PublicClient> = {
	provide: SETTLEMENT_PUBLIC_CLIENT,
	inject: [TypedConfigService],
	useFactory: (config: TypedConfigService): PublicClient =>
		createPublicClient({
			chain: SETTLEMENT_CHAINS[config.get('settlement.chainId')],
			transport: http(config.get('settlement.rpcUrl'), {
				timeout: SETTLEMENT_RPC_TIMEOUT_MILLISECONDS,
			}),
		}),
};
