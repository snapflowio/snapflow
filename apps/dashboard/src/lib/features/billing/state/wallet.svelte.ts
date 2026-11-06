/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PublicSettlementConfig } from '@snapflow/api-client';
import { getConnection, signMessage, watchConnection } from '@wagmi/core';
import { createSubscriber } from 'svelte/reactivity';
import { type Address, getAddress, isAddress, isAddressEqual } from 'viem';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import type { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import { getPublicConfig } from '#lib/api/public-config.ts';
import type { EscrowWallet } from '#lib/features/billing/lib/escrow-contract.ts';
import { walletError } from '#lib/features/billing/lib/wallet-error.ts';
import type {
	WalletKit,
	WalletView,
} from '#lib/integrations/wallet/wallet-kit.ts';

const WALLET_WINDOW_FAILURE = 'Could not open the wallet window';
const SWITCH_NETWORK_FAILURE = 'Could not switch the wallet network';
const NOT_CONNECTED_MESSAGE = 'Connect a wallet first.';

export class WalletConnection {
	readonly #kit: WalletKit;
	readonly #escrow: Address;
	readonly #usdc: Address;
	readonly #subscribe: () => void;

	constructor(kit: WalletKit, settlement: PublicSettlementConfig) {
		this.#kit = kit;
		this.#escrow = getAddress(settlement.escrowAddress);
		this.#usdc = getAddress(settlement.usdcAddress);
		this.#subscribe = createSubscriber((update) =>
			watchConnection(kit.config, { onChange: update })
		);
	}

	get #connection() {
		this.#subscribe();
		return getConnection(this.#kit.config);
	}

	get address(): Address | undefined {
		return this.#connection.address;
	}

	get connected(): boolean {
		return this.#connection.status === 'connected';
	}

	get connecting(): boolean {
		const { status } = this.#connection;
		return status === 'connecting' || status === 'reconnecting';
	}

	get onSettlementChain(): boolean {
		return this.#connection.chainId === this.#kit.network.id;
	}

	get networkName(): string {
		return this.#kit.network.name;
	}

	get escrow(): EscrowWallet | null {
		const account = this.address;
		if (!(account && this.connected && this.onSettlementChain)) return null;
		return {
			config: this.#kit.config,
			chainId: this.#kit.network.id,
			account,
			escrow: this.#escrow,
			usdc: this.#usdc,
		};
	}

	controls = (address: string | null | undefined): boolean => {
		const account = this.address;
		return Boolean(
			account &&
				address &&
				isAddress(address) &&
				isAddressEqual(account, address)
		);
	};

	#open(view: WalletView): void {
		this.#kit.appKit
			.open({ view })
			.catch((error: unknown) =>
				showApiError(walletError(error), WALLET_WINDOW_FAILURE)
			);
	}

	connect = (): void => this.#open('Connect');

	manage = (): void => this.#open('Account');

	buyUsdc = (): void => this.#open('OnRampProviders');

	switchNetwork = (): void => {
		this.#kit.appKit
			.switchNetwork(this.#kit.network, { throwOnFailure: true })
			.catch((error: unknown) =>
				showApiError(walletError(error), SWITCH_NETWORK_FAILURE)
			);
	};

	signMessage = async (message: string): Promise<string> => {
		const account = this.address;
		if (!account) throw walletError(NOT_CONNECTED_MESSAGE);
		try {
			return await signMessage(this.#kit.config, { account, message });
		} catch (error) {
			throw walletError(error);
		}
	};
}

type WalletState =
	| { status: 'unconfigured' }
	| { status: 'loading' }
	| { status: 'failed'; error: SnapflowError }
	| { status: 'ready'; connection: WalletConnection };

export class Wallet {
	readonly #settlement: PublicSettlementConfig;
	readonly #projectId: string | null;
	state = $state.raw<WalletState>({ status: 'loading' });

	constructor() {
		const config = getPublicConfig();
		this.#settlement = config.settlement;
		this.#projectId = config.reownProjectId;
		this.load();
	}

	load = (): void => {
		const projectId = this.#projectId;
		if (projectId === null) {
			this.state = { status: 'unconfigured' };
			return;
		}
		const settlement = this.#settlement;
		this.state = { status: 'loading' };
		import('#lib/integrations/wallet/wallet-kit.ts')
			.then(({ walletKit }) => {
				this.state = {
					status: 'ready',
					connection: new WalletConnection(
						walletKit({ chainId: settlement.chainId, projectId }),
						settlement
					),
				};
			})
			.catch((error: unknown) => {
				this.state = { status: 'failed', error: walletError(error) };
			});
	};
}
