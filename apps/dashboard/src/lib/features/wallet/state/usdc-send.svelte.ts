/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PreparedWalletCall } from '@snapflow/sdk';
import { createMutation } from '@tanstack/svelte-query';
import { getAddress, isAddress, isAddressEqual } from 'viem';
import {
	prepareUsdcSendMutationOptions,
	sendUsdcMutationOptions,
} from '#lib/api/settlement/user-wallet.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { usdcAmountError, usdcInputUnits } from '#lib/utils/usd.ts';

const INVALID_RECIPIENT_MESSAGE = 'Enter an address that starts with 0x.';
const OWN_ADDRESS_MESSAGE = 'This is your wallet’s own address.';
const ABOVE_BALANCE_MESSAGE = 'This is more USDC than the wallet holds.';

export class UsdcSend {
	readonly #walletOf: () => UserWalletState;
	recipient = $state('');
	amount = $state('');
	prepared = $state.raw<PreparedWalletCall | null>(null);

	readonly preparation = createMutation(() => prepareUsdcSendMutationOptions());
	readonly mutation = createMutation(() => sendUsdcMutationOptions());
	readonly #wallet = $derived.by(() => this.#walletOf());

	readonly #trimmedRecipient = $derived(this.recipient.trim());
	readonly recipientError = $derived.by(() => {
		if (this.#trimmedRecipient === '') return null;
		if (!isAddress(this.#trimmedRecipient)) return INVALID_RECIPIENT_MESSAGE;
		const own = this.#wallet.address;
		return own && isAddressEqual(own, this.#trimmedRecipient)
			? OWN_ADDRESS_MESSAGE
			: null;
	});
	readonly units = $derived(usdcInputUnits(this.amount));
	readonly amountError = $derived(
		usdcAmountError(
			this.amount,
			this.#wallet.balance.data,
			ABOVE_BALANCE_MESSAGE
		)
	);
	readonly pending = $derived(
		this.preparation.isPending || this.mutation.isPending
	);
	readonly feeMicroUsd = $derived(
		this.prepared?.transaction.feeMicroUsd ?? null
	);
	readonly ready = $derived(
		this.#wallet.recoveryActive &&
			this.#wallet.signing !== null &&
			this.#trimmedRecipient !== '' &&
			this.recipientError === null &&
			this.units !== null &&
			this.amountError === null &&
			!this.pending
	);

	constructor(wallet: () => UserWalletState) {
		this.#walletOf = wallet;
	}

	review = (): void => {
		const signing = this.#wallet.signing;
		if (!(this.ready && signing && this.units !== null)) return;
		this.preparation.mutate(
			{
				target: signing.target,
				usdcAddress: getAddress(this.#wallet.settlement.usdcAddress),
				recipient: getAddress(this.#trimmedRecipient),
				amount: this.units,
			},
			{
				onSuccess: (prepared) => {
					this.prepared = prepared;
				},
			}
		);
	};

	confirm = (onSent?: () => void): void => {
		const signing = this.#wallet.signing;
		const prepared = this.prepared;
		if (!(signing && prepared) || this.mutation.isPending) return;
		this.mutation.mutate(
			{ prepared, signer: signing.signer },
			{
				onSuccess: () => {
					this.recipient = '';
					this.amount = '';
					onSent?.();
				},
				onSettled: () => {
					this.prepared = null;
				},
			}
		);
	};

	cancel = (): void => {
		if (this.mutation.isPending) return;
		this.prepared = null;
	};
}
