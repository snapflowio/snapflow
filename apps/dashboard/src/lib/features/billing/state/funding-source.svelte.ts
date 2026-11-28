/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createQuery } from '@tanstack/svelte-query';
import { type Address, getAddress, isAddress } from 'viem';
import type { EscrowFunderSource } from '#lib/api/settlement/escrow-writes.ts';
import {
	sameAddress,
	shortAddress,
} from '#lib/features/wallet/lib/payment-wallet.ts';
import type { ConnectedWallet } from '#lib/features/wallet/state/connected-wallet.svelte.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { usdcBalanceQueryOptions } from '#lib/integrations/wallet/usdc-balance.ts';

export const FundingSigner = {
	Safe: 'safe',
	Connected: 'connected',
} as const;

export type FundingSigner = (typeof FundingSigner)[keyof typeof FundingSigner];

const MANAGE_BILLING_HINT = 'Ask a member who manages billing to change this.';

const SIGNER_LABELS = {
	[FundingSigner.Safe]: 'your Snapflow wallet',
	[FundingSigner.Connected]: 'the connected wallet',
} as const satisfies Record<FundingSigner, string>;

export class FundingSource {
	readonly #fundingAddress: () => string | null;
	readonly #walletOf: () => UserWalletState;
	readonly #connectedOf: () => ConnectedWallet;

	readonly #wallet = $derived.by(() => this.#walletOf());
	readonly #connected = $derived.by(() => this.#connectedOf());
	preferredPayer = $state<FundingSigner | null>(null);

	readonly account: Address | null = $derived.by(() => {
		const address = this.#fundingAddress();
		return address && isAddress(address) ? getAddress(address) : null;
	});
	readonly safeAvailable = $derived(this.#wallet.signing !== null);
	readonly connectedAvailable = $derived(this.#connected.ready);
	readonly signer: FundingSigner | null = $derived.by(() => {
		if (!this.account) return null;
		if (
			this.#wallet.signing &&
			sameAddress(this.#wallet.address, this.account)
		) {
			return FundingSigner.Safe;
		}
		return this.#connected.ready && this.#connected.controls(this.account)
			? FundingSigner.Connected
			: null;
	});
	readonly signerLabel = $derived(
		this.signer ? SIGNER_LABELS[this.signer] : null
	);
	readonly hint = $derived.by(() => {
		if (!this.account) return 'Link a funding wallet first.';
		if (this.signer) return null;
		return `Connect ${shortAddress(this.account)} on ${this.#connected.networkName}, or make your Snapflow wallet the funding wallet.`;
	});
	readonly payer: FundingSigner | null = $derived.by(() => {
		if (!this.account) return null;
		if (this.preferredPayer === FundingSigner.Safe && this.safeAvailable) {
			return FundingSigner.Safe;
		}
		if (
			this.preferredPayer === FundingSigner.Connected &&
			this.connectedAvailable
		) {
			return FundingSigner.Connected;
		}
		if (this.signer) return this.signer;
		if (this.connectedAvailable) return FundingSigner.Connected;
		return this.safeAvailable ? FundingSigner.Safe : null;
	});
	readonly #payerAddress: Address | null = $derived.by(() => {
		if (this.payer === FundingSigner.Safe) return this.#wallet.address;
		if (this.payer === FundingSigner.Connected)
			return this.#connected.address ?? null;
		return null;
	});
	readonly payerLabel = $derived(this.payer ? SIGNER_LABELS[this.payer] : null);
	readonly depositHint = $derived.by(() => {
		if (!this.account) return 'Link a funding wallet first.';
		if (this.payer) return null;
		return `Connect a wallet on ${this.#connected.networkName} or create your Snapflow wallet to deposit.`;
	});
	readonly payerBalance;

	constructor(
		fundingAddress: () => string | null,
		wallet: () => UserWalletState,
		connected: () => ConnectedWallet
	) {
		this.#fundingAddress = fundingAddress;
		this.#walletOf = wallet;
		this.#connectedOf = connected;
		this.payerBalance = createQuery(() =>
			usdcBalanceQueryOptions(this.#wallet.settlement, this.#payerAddress)
		);
	}

	hintFor = (canManage: boolean): string | null =>
		canManage ? this.hint : MANAGE_BILLING_HINT;

	#funderOf = (signer: FundingSigner | null) =>
		signer === FundingSigner.Safe
			? this.#wallet.escrowFunder()
			: this.#connected.escrowFunder();

	readonly funder: EscrowFunderSource = () => this.#funderOf(this.signer);

	readonly payerFunder: EscrowFunderSource = () => this.#funderOf(this.payer);
}
