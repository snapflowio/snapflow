/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PublicSettlementConfig } from '@snapflow/api-client';
import { walletConnect } from '@wagmi/connectors/walletConnect';
import {
	type Config,
	type CreateConnectorFn,
	createConfig,
	getPublicClient,
	injected,
	reconnect,
} from '@wagmi/core';
import { type Chain, http, type PublicClient, type Transport } from 'viem';
import { SETTLEMENT_RPC_PATH } from '#lib/config/service-paths.ts';
import { asset } from '$app/paths';
import { settlementChain } from './wallet-networks.ts';

const WALLET_METADATA = {
	name: 'Snapflow',
	description: 'Fund your Snapflow escrow and receive host payouts',
} as const;
const WALLET_ICON_PATH = 'favicon.svg';

type SettlementWalletSettings = Pick<
	PublicSettlementConfig,
	'chainId' | 'walletConnectProjectId'
>;

export interface SettlementWallets {
	chain: Chain;
	config: Config;
	publicClient: PublicClient<Transport, Chain>;
}

let current: SettlementWallets | undefined;

function walletConnectors(projectId: string | null): CreateConnectorFn[] {
	const browserWallets = injected();
	if (!projectId) return [browserWallets];
	const { origin } = window.location;
	return [
		browserWallets,
		walletConnect({
			projectId,
			showQrModal: false,
			metadata: {
				...WALLET_METADATA,
				url: origin,
				icons: [new URL(asset(WALLET_ICON_PATH), origin).href],
			},
		}),
	];
}

function createSettlementWallets(
	settings: SettlementWalletSettings
): SettlementWallets {
	const chain = settlementChain(settings.chainId);
	const chains: readonly [Chain] = [chain];
	const config = createConfig({
		chains,
		connectors: walletConnectors(settings.walletConnectProjectId),
		multiInjectedProviderDiscovery: true,
		transports: {
			[chain.id]: http(
				new URL(SETTLEMENT_RPC_PATH, window.location.origin).href
			),
		},
	});
	const publicClient = getPublicClient(config, { chainId: chain.id });
	if (!publicClient) {
		throw new Error(`No public client is configured for chain ${chain.id}.`);
	}
	void reconnect(config);
	return { chain, config, publicClient };
}

export function settlementWallets(
	settings: SettlementWalletSettings
): SettlementWallets {
	current ??= createSettlementWallets(settings);
	if (current.chain.id !== settings.chainId) {
		throw new Error(
			'The wallet connection is set up for another settlement chain; reload the page.'
		);
	}
	return current;
}
