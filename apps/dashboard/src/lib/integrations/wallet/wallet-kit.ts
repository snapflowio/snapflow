/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type AppKit, createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import type { Config } from '@wagmi/core';
import { asset } from '$app/paths';
import {
	type SettlementChainId,
	type SettlementNetwork,
	settlementNetwork,
} from './wallet-networks.ts';
import { walletThemeMode, walletThemeVariables } from './wallet-theme.ts';

const APP_NAME = 'Snapflow';
const APP_DESCRIPTION = 'Pay for sandboxes and receive host earnings in USDC.';
const APP_ICON_PATH = 'favicon.svg';

export interface WalletKitOptions {
	chainId: SettlementChainId;
	projectId: string;
}

export interface WalletKit {
	appKit: AppKit;
	config: Config;
	network: SettlementNetwork;
}

export type WalletView = NonNullable<Parameters<AppKit['open']>[0]>['view'];

let current: { key: string; kit: WalletKit } | undefined;

function optionsKey({ chainId, projectId }: WalletKitOptions): string {
	return `${chainId}:${projectId}`;
}

function createWalletKit({ chainId, projectId }: WalletKitOptions): WalletKit {
	const network = settlementNetwork(chainId);
	const adapter = new WagmiAdapter({ networks: [network], projectId });
	const appKit = createAppKit({
		adapters: [adapter],
		networks: [network],
		defaultNetwork: network,
		projectId,
		metadata: {
			name: APP_NAME,
			description: APP_DESCRIPTION,
			url: window.location.origin,
			icons: [new URL(asset(APP_ICON_PATH), window.location.origin).href],
		},
		themeMode: walletThemeMode(),
		themeVariables: walletThemeVariables(),
		coinbasePreference: 'all',
		allowUnsupportedChain: false,
		features: {
			analytics: false,
			email: false,
			socials: false,
			swaps: false,
			send: false,
			history: false,
			onramp: true,
		},
	});
	return { appKit, config: adapter.wagmiConfig, network };
}

export function walletKit(options: WalletKitOptions): WalletKit {
	const key = optionsKey(options);
	current ??= { key, kit: createWalletKit(options) };
	if (current.key !== key) {
		throw new Error(
			'The wallet connection is set up for another settlement chain; reload the page.'
		);
	}
	return current.kit;
}
