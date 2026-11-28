/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { walletExecutor } from '@snapflow/sdk';
import {
	type Connector,
	connect,
	disconnect,
	getConnection,
	getConnectors,
	getWalletClient,
	switchChain,
	watchConnection,
	watchConnectors,
} from '@wagmi/core';
import { createSubscriber } from 'svelte/reactivity';
import type { Address } from 'viem';
import { getPublicConfig } from '#lib/api/public-config.ts';
import type { EscrowFunder } from '#lib/api/settlement/escrow-writes.ts';
import { sameAddress } from '#lib/features/wallet/lib/payment-wallet.ts';
import {
	type SettlementWallets,
	settlementWallets,
} from '#lib/integrations/wallet/wallet-config.ts';
import { walletCall } from '#lib/integrations/wallet/wallet-error.ts';

const GENERIC_INJECTED_CONNECTOR_ID = 'injected';
const INJECTED_CONNECTOR_TYPE = 'injected';
const WALLET_CONNECT_CONNECTOR_TYPE = 'walletConnect';
const PAIRING_URI_MESSAGE = 'display_uri';

export class ConnectedWallet {
	readonly #wallets: SettlementWallets;
	readonly #subscribeConnection: () => void;
	readonly #subscribeConnectors: () => void;

	constructor() {
		this.#wallets = settlementWallets(getPublicConfig().settlement);
		const { config } = this.#wallets;
		this.#subscribeConnection = createSubscriber((update) =>
			watchConnection(config, { onChange: update })
		);
		this.#subscribeConnectors = createSubscriber((update) =>
			watchConnectors(config, { onChange: update })
		);
	}

	get #connection() {
		this.#subscribeConnection();
		return getConnection(this.#wallets.config);
	}

	pairingUri: string | null = $state(null);
	#pairing: { connector: Connector; attempt: number } | null = null;
	#pairingAttempts = 0;
	#cancelledAttempt: number | null = null;

	get connectors(): readonly Connector[] {
		this.#subscribeConnectors();
		const all = getConnectors(this.#wallets.config);
		const browser = all.filter(
			(connector) => connector.type === INJECTED_CONNECTOR_TYPE
		);
		const discovered = browser.filter(
			(connector) => connector.id !== GENERIC_INJECTED_CONNECTOR_ID
		);
		return [
			...(discovered.length > 0 ? discovered : browser),
			...all.filter((connector) => connector.type !== INJECTED_CONNECTOR_TYPE),
		];
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

	get connectorName(): string | undefined {
		return this.#connection.connector?.name;
	}

	get onSettlementChain(): boolean {
		return this.#connection.chainId === this.#wallets.chain.id;
	}

	get networkName(): string {
		return this.#wallets.chain.name;
	}

	get ready(): boolean {
		return this.connected && this.onSettlementChain;
	}

	controls = (address: string | null | undefined): boolean =>
		sameAddress(this.address, address);

	connect = async (connector: Connector): Promise<unknown> => {
		if (connector.type !== WALLET_CONNECT_CONNECTOR_TYPE) {
			return this.#connect(connector);
		}
		const showPairing = ({ type, data }: { type: string; data?: unknown }) => {
			if (type === PAIRING_URI_MESSAGE && typeof data === 'string') {
				this.pairingUri = data;
			}
		};
		const attempt = ++this.#pairingAttempts;
		this.#pairing = { connector, attempt };
		connector.emitter.on('message', showPairing);
		try {
			return await this.#connect(connector);
		} catch (error) {
			if (this.#cancelledAttempt === attempt) return null;
			throw error;
		} finally {
			connector.emitter.off('message', showPairing);
			if (this.#pairing?.attempt === attempt) {
				this.#pairing = null;
				this.pairingUri = null;
			}
		}
	};

	cancelPairing = async (): Promise<void> => {
		const pairing = this.#pairing;
		this.pairingUri = null;
		this.#pairing = null;
		if (!pairing) return;
		this.#cancelledAttempt = pairing.attempt;
		await walletCall(() =>
			disconnect(this.#wallets.config, { connector: pairing.connector })
		);
	};

	#connect = (connector: Connector): Promise<unknown> =>
		walletCall(() =>
			connect(this.#wallets.config, {
				connector,
				chainId: this.#wallets.chain.id,
			})
		);

	disconnect = (): Promise<void> =>
		walletCall(() => disconnect(this.#wallets.config));

	switchNetwork = (): Promise<unknown> =>
		walletCall(() =>
			switchChain(this.#wallets.config, { chainId: this.#wallets.chain.id })
		);

	walletClient = () =>
		walletCall(() =>
			getWalletClient(this.#wallets.config, {
				chainId: this.#wallets.chain.id,
			})
		);

	escrowFunder = async (): Promise<EscrowFunder> => {
		const { publicClient } = this.#wallets;
		return {
			executor: walletExecutor({
				walletClient: await this.walletClient(),
				publicClient,
			}),
			publicClient,
		};
	};
}
