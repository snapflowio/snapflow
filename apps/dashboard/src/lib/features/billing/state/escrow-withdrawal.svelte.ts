/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EscrowAccount } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { inlineFailureMutation } from '#lib/api/client/mutation-meta.ts';
import {
	cancelWithdrawalMutationOptions,
	completeWithdrawalMutationOptions,
	requestWithdrawalMutationOptions,
} from '#lib/api/settlement/escrow-writes.ts';
import {
	amountError,
	runwayAfterSeconds,
} from '#lib/features/billing/lib/escrow-amount.ts';
import type { FundingSource } from '#lib/features/billing/state/funding-source.svelte.ts';

const ABOVE_FREE_MESSAGE = 'This is more than you can withdraw.';
const MILLISECONDS_PER_SECOND = 1_000;

export class EscrowWithdrawal {
	readonly #account: () => EscrowAccount;
	readonly #sourceOf: () => FundingSource;
	readonly #source = $derived.by(() => this.#sourceOf());
	amount = $state<bigint | null>(null);

	readonly request = createMutation(() =>
		inlineFailureMutation(requestWithdrawalMutationOptions())
	);
	readonly cancel = createMutation(() =>
		inlineFailureMutation(cancelWithdrawalMutationOptions())
	);
	readonly complete = createMutation(() =>
		inlineFailureMutation(completeWithdrawalMutationOptions())
	);
	readonly free = $derived.by(() => BigInt(this.#account().freeMicroUsd));
	readonly error = $derived.by(() =>
		amountError(this.amount, this.free, ABOVE_FREE_MESSAGE)
	);
	readonly busy = $derived(
		this.request.isPending || this.cancel.isPending || this.complete.isPending
	);
	readonly ready = $derived(
		this.#source.signer !== null &&
			this.amount !== null &&
			this.error === null &&
			!this.busy
	);
	readonly availableAfter = $derived.by(() => {
		const left =
			BigInt(this.#account().availableMicroUsd) - (this.amount ?? 0n);
		return left > 0n ? left : 0n;
	});
	readonly runwayAfterSeconds = $derived.by(() =>
		runwayAfterSeconds(
			this.availableAfter,
			BigInt(this.#account().burnMicroUsdPerHour)
		)
	);

	constructor(account: () => EscrowAccount, source: () => FundingSource) {
		this.#account = account;
		this.#sourceOf = source;
	}

	get hasPending(): boolean {
		return BigInt(this.#account().pendingMicroUsd) > 0n;
	}

	unlocksAt(now: Date): Date {
		return new Date(
			now.getTime() +
				this.#account().windows.withdrawalDelaySeconds * MILLISECONDS_PER_SECOND
		);
	}

	withdrawAll = (): void => {
		this.amount = this.free;
	};

	reset = (): void => {
		if (this.busy) return;
		this.amount = null;
	};

	submit = (onDone: () => void): void => {
		if (!(this.ready && this.amount !== null)) return;
		this.request.mutate(
			{ funder: this.#source.funder, amount: this.amount },
			{
				onSuccess: () => {
					this.amount = null;
					onDone();
				},
			}
		);
	};
}
