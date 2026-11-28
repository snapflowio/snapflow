/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	EscrowEventKind,
	type PaymentWallet,
	PaymentWalletPurpose,
	SettlementParty,
} from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { quietMutation } from '#lib/api/client/mutation-meta.ts';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import { recentEscrowEventsQueryOptions } from '#lib/api/settlement/escrow.ts';
import {
	linkOwnPaymentWalletMutationOptions,
	linkPaymentWalletMutationOptions,
} from '#lib/api/settlement/wallets.ts';
import {
	lookalikeAddress,
	payoutAddressHistory,
} from '#lib/features/earnings/lib/similar-address.ts';
import { sameAddress } from '#lib/features/wallet/lib/payment-wallet.ts';
import { ConnectedWallet } from '#lib/features/wallet/state/connected-wallet.svelte.ts';
import { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';

export const PayoutWalletSource = {
	Snapflow: 'snapflow',
	Browser: 'browser',
} as const;

export type PayoutWalletSource =
	(typeof PayoutWalletSource)[keyof typeof PayoutWalletSource];

export const PayoutWalletStep = {
	Choose: 'choose',
	Review: 'review',
} as const;

export type PayoutWalletStep =
	(typeof PayoutWalletStep)[keyof typeof PayoutWalletStep];

export const PAYOUT_WALLET_STEPS: readonly PayoutWalletStep[] = [
	PayoutWalletStep.Choose,
	PayoutWalletStep.Review,
];

const HISTORY_EVENTS_LIMIT = 50;
const SAME_WALLET_MESSAGE = 'This is already your payout wallet';
const NO_SNAPFLOW_WALLET_MESSAGE = 'Create your Snapflow wallet first';
const CONNECT_FIRST_MESSAGE = 'Connect a browser wallet first';

export class PayoutWalletChange {
	readonly #current: () => PaymentWallet | undefined;
	readonly own = new UserWalletState();
	readonly connected = new ConnectedWallet();
	readonly #linkOwn = createMutation(() =>
		quietMutation(linkOwnPaymentWalletMutationOptions())
	);
	readonly #link = createMutation(() =>
		quietMutation(linkPaymentWalletMutationOptions())
	);
	readonly #history = createQuery(() =>
		recentEscrowEventsQueryOptions({
			limit: HISTORY_EVENTS_LIMIT,
			role: SettlementParty.Host,
			kind: [EscrowEventKind.PayoutAddressSet],
		})
	);

	source = $state<PayoutWalletSource>(PayoutWalletSource.Snapflow);
	step = $state<PayoutWalletStep>(PayoutWalletStep.Choose);
	#walletError = $state<string | null>(null);

	readonly current = $derived.by(() => this.#current());
	readonly pending = $derived(this.#linkOwn.isPending || this.#link.isPending);
	readonly candidate: string | null = $derived.by(() =>
		this.source === PayoutWalletSource.Snapflow
			? (this.own.address ?? null)
			: (this.connected.address ?? null)
	);
	readonly wrongChain = $derived(
		this.source === PayoutWalletSource.Browser &&
			this.connected.connected &&
			!this.connected.onSettlementChain
	);
	readonly chooseError: string | null = $derived.by(() => {
		if (!this.candidate) {
			return this.source === PayoutWalletSource.Snapflow
				? NO_SNAPFLOW_WALLET_MESSAGE
				: CONNECT_FIRST_MESSAGE;
		}
		if (sameAddress(this.candidate, this.current?.address)) {
			return SAME_WALLET_MESSAGE;
		}
		return null;
	});
	readonly canContinue = $derived(
		this.chooseError === null && !this.wrongChain
	);
	readonly lookalike: string | null = $derived.by(() => {
		if (!this.candidate) return null;
		const anchors = [
			...(this.current ? [this.current.address] : []),
			...payoutAddressHistory(this.#history.data?.items ?? []),
		];
		return lookalikeAddress(this.candidate, anchors);
	});
	readonly error: string | null = $derived.by(() => {
		if (this.#walletError) return this.#walletError;
		const failure = this.#linkOwn.error ?? this.#link.error;
		return failure ? userErrorMessage(failure) : null;
	});
	readonly stepNumber = $derived(PAYOUT_WALLET_STEPS.indexOf(this.step) + 1);

	constructor(current: () => PaymentWallet | undefined) {
		this.#current = current;
	}

	reset = (): void => {
		this.step = PayoutWalletStep.Choose;
		this.source = PayoutWalletSource.Snapflow;
		this.#walletError = null;
		this.#linkOwn.reset();
		this.#link.reset();
	};

	review = (): void => {
		if (this.canContinue) this.step = PayoutWalletStep.Review;
	};

	back = (): void => {
		this.#walletError = null;
		this.step = PayoutWalletStep.Choose;
	};

	switchNetwork = async (): Promise<void> => {
		try {
			await this.connected.switchNetwork();
		} catch (error) {
			this.#walletError = userErrorMessage(error);
		}
	};

	confirm = async (onDone: () => void): Promise<void> => {
		if (!this.canContinue || this.pending) return;
		this.#walletError = null;
		if (this.source === PayoutWalletSource.Snapflow) {
			this.#linkOwn.mutate(PaymentWalletPurpose.Payout, { onSuccess: onDone });
			return;
		}
		try {
			const wallet = await this.connected.walletClient();
			this.#link.mutate(
				{ purpose: PaymentWalletPurpose.Payout, wallet },
				{ onSuccess: onDone }
			);
		} catch (error) {
			this.#walletError = userErrorMessage(error);
		}
	};
}
