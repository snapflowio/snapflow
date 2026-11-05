/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FactoryProvider } from '@nestjs/common';
import {
	type Chain,
	createWalletClient,
	type HttpTransport,
	http,
	type WalletClient,
} from 'viem';
import { type PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	SETTLEMENT_CHAINS,
	SETTLEMENT_RELAYER_WALLET,
	SETTLEMENT_RPC_TIMEOUT_MILLISECONDS,
} from '../constants/settlement.constants';

export type RelayerWallet = WalletClient<
	HttpTransport,
	Chain,
	PrivateKeyAccount
>;

// The wallet that sends claims and pays their gas. Nonces come from the
// chain's pending count rather than an in-process counter: only one batch is
// ever in flight, and a dropped transaction must not leave a gap behind.
export const relayerWalletProvider: FactoryProvider<RelayerWallet> = {
	provide: SETTLEMENT_RELAYER_WALLET,
	inject: [TypedConfigService],
	useFactory: (config: TypedConfigService): RelayerWallet => {
		const privateKey = config.get('settlement.relayerPrivateKey');
		if (privateKey === undefined) {
			throw new Error(
				'SETTLEMENT_RELAYER_PRIVATE_KEY is required where scheduled jobs run'
			);
		}
		return createWalletClient({
			account: privateKeyToAccount(privateKey),
			chain: SETTLEMENT_CHAINS[config.get('settlement.chainId')],
			transport: http(config.get('settlement.rpcUrl'), {
				timeout: SETTLEMENT_RPC_TIMEOUT_MILLISECONDS,
			}),
		});
	},
};
