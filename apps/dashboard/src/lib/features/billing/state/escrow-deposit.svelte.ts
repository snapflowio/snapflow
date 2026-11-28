/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EscrowAccount, VoucherDelegation } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import {
	type AutomaticPaymentsGrant,
	escrowDepositMutationOptions,
	type FundingDepositStep,
} from '#lib/api/settlement/escrow-writes.ts';
import { automaticPaymentsAuthorizable } from '#lib/features/billing/lib/billing-overview.ts';
import {
	aboveCapMessage,
	amountError,
	belowMinimumMessage,
	runwayAfterSeconds,
} from '#lib/features/billing/lib/escrow-amount.ts';
import type { FundingSource } from '#lib/features/billing/state/funding-source.svelte.ts';
import { SignerScopeDraft } from '#lib/features/billing/state/signer-scope-draft.svelte.ts';

const ABOVE_BALANCE_MESSAGE = 'This is more USDC than the paying wallet holds.';

export const DepositProgress = {
	Signing: 'signing',
	Sent: 'sent',
	Confirming: 'confirming',
	Added: 'added',
} as const;

export type DepositProgress =
	(typeof DepositProgress)[keyof typeof DepositProgress];

export interface EscrowDepositInputs {
	source: () => FundingSource;
	account: () => EscrowAccount | undefined;
	minimum: () => bigint | null;
	delegation: () => VoucherDelegation | undefined;
	observed: (transactionHash: string) => boolean;
}

export class EscrowDeposit {
	readonly #inputs: EscrowDepositInputs;
	readonly #source = $derived.by(() => this.#inputs.source());
	readonly #delegation = $derived.by(() => this.#inputs.delegation());
	readonly #account = $derived.by(() => this.#inputs.account());
	amount = $state<bigint | null>(null);
	turnOnAutomaticPayments = $state(true);
	step = $state<FundingDepositStep | null>(null);

	readonly mutation = createMutation(() => escrowDepositMutationOptions());
	readonly room = $derived(
		this.#account?.depositRoomMicroUsd
			? BigInt(this.#account.depositRoomMicroUsd)
			: null
	);
	readonly offersAutomaticPayments = $derived(
		this.#delegation !== undefined &&
			this.#source.signer !== null &&
			automaticPaymentsAuthorizable(this.#delegation)
	);
	readonly withAutomaticPayments = $derived(
		this.offersAutomaticPayments && this.turnOnAutomaticPayments
	);
	readonly batched = $derived(this.#source.payer === this.#source.signer);
	readonly error = $derived.by(() => {
		const minimum = this.#inputs.minimum();
		if (this.amount !== null && minimum !== null && this.amount < minimum) {
			return belowMinimumMessage(minimum);
		}
		if (this.amount !== null && this.room !== null && this.amount > this.room) {
			return aboveCapMessage(this.room);
		}
		return amountError(
			this.amount,
			this.#source.payerBalance.data,
			ABOVE_BALANCE_MESSAGE
		);
	});
	readonly ready = $derived(
		this.#source.payer !== null &&
			this.amount !== null &&
			this.error === null &&
			!this.mutation.isPending
	);
	readonly availableAfter = $derived(
		BigInt(this.#account?.availableMicroUsd ?? '0') + (this.amount ?? 0n)
	);
	readonly runwayAfterSeconds = $derived(
		runwayAfterSeconds(
			this.availableAfter,
			BigInt(this.#account?.burnMicroUsdPerHour ?? '0')
		)
	);
	readonly receipt = $derived(this.mutation.data ?? null);
	readonly progress: DepositProgress | null = $derived.by(() => {
		if (this.mutation.isPending) return DepositProgress.Signing;
		const receipt = this.receipt;
		if (!receipt) return null;
		if (this.#inputs.observed(receipt.transactionHash)) {
			return DepositProgress.Confirming;
		}
		const indexed = this.#account?.indexedThroughBlock ?? null;
		return indexed !== null && BigInt(indexed) >= receipt.blockNumber
			? DepositProgress.Added
			: DepositProgress.Sent;
	});

	constructor(inputs: EscrowDepositInputs) {
		this.#inputs = inputs;
	}

	#automaticPayments(): AutomaticPaymentsGrant | null {
		const delegation = this.#delegation;
		if (!(this.withAutomaticPayments && delegation)) return null;
		const scope = new SignerScopeDraft(
			() => delegation.suggestedSignerScope,
			() => delegation.chainNowSeconds
		).scope();
		if (!scope) {
			throw new Error('The suggested automatic payment scope is invalid');
		}
		return { funder: this.#source.funder, scope, batched: this.batched };
	}

	reset = (): void => {
		if (this.mutation.isPending) return;
		this.amount = null;
		this.step = null;
		this.mutation.reset();
	};

	submit = (): void => {
		const customer = this.#source.account;
		if (!(this.ready && this.amount !== null && customer)) return;
		this.mutation.mutate(
			{
				funder: this.#source.payerFunder,
				customer,
				amount: this.amount,
				automaticPayments: this.#automaticPayments(),
				onStep: (step) => {
					this.step = step;
				},
			},
			{
				onSettled: () => {
					this.step = null;
				},
			}
		);
	};
}
