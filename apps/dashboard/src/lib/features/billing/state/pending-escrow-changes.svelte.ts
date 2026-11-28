/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EscrowAccount } from '@snapflow/api-client';
import {
	type Mutation,
	type MutationStatus,
	useMutationState,
} from '@tanstack/svelte-query';
import type { TransactionReceipt } from 'viem';
import {
	ESCROW_DEPOSIT_MUTATION_KEY,
	ESCROW_WITHDRAWAL_CANCEL_MUTATION_KEY,
	ESCROW_WITHDRAWAL_COMPLETE_MUTATION_KEY,
	ESCROW_WITHDRAWAL_REQUEST_MUTATION_KEY,
} from '#lib/api/settlement/escrow.ts';
import type {
	EscrowAmount,
	EscrowDepositFor,
} from '#lib/api/settlement/escrow-writes.ts';
import type {
	LocalEscrowActivity,
	LocalEscrowChange,
} from '#lib/features/billing/lib/pending-escrow.ts';

type EscrowWrite<Variables> = Mutation<
	TransactionReceipt,
	Error,
	Variables,
	unknown
>;

type IndexedAccount = Pick<EscrowAccount, 'indexedThroughBlock'>;

const SUCCESS: MutationStatus = 'success';
const PENDING: MutationStatus = 'pending';

function confirmedChange<Variables extends EscrowAmount>(
	mutation: EscrowWrite<Variables>
): LocalEscrowChange | null {
	const { data, variables } = mutation.state;
	return data && variables
		? {
				transactionHash: data.transactionHash,
				amount: variables.amount,
				blockNumber: data.blockNumber,
			}
		: null;
}

function unindexed(
	changes: readonly (LocalEscrowChange | null)[],
	account: IndexedAccount | undefined
): LocalEscrowChange[] {
	const indexed = account?.indexedThroughBlock ?? null;
	return changes.filter(
		(change): change is LocalEscrowChange =>
			change !== null &&
			(indexed === null || BigInt(indexed) < change.blockNumber)
	);
}

function total(changes: readonly LocalEscrowChange[]): bigint {
	return changes.reduce((sum, change) => sum + change.amount, 0n);
}

export class PendingEscrowChanges implements LocalEscrowActivity {
	readonly #account: () => IndexedAccount | undefined;
	readonly #deposits = useMutationState<
		LocalEscrowChange | null,
		EscrowWrite<EscrowDepositFor>
	>({
		filters: { mutationKey: ESCROW_DEPOSIT_MUTATION_KEY, status: SUCCESS },
		select: confirmedChange,
	});
	readonly #withdrawals = useMutationState<
		LocalEscrowChange | null,
		EscrowWrite<EscrowAmount>
	>({
		filters: {
			mutationKey: ESCROW_WITHDRAWAL_REQUEST_MUTATION_KEY,
			status: SUCCESS,
		},
		select: confirmedChange,
	});
	readonly #cancels = useMutationState({
		filters: {
			mutationKey: ESCROW_WITHDRAWAL_CANCEL_MUTATION_KEY,
			status: PENDING,
		},
	});
	readonly #completes = useMutationState({
		filters: {
			mutationKey: ESCROW_WITHDRAWAL_COMPLETE_MUTATION_KEY,
			status: PENDING,
		},
	});

	readonly deposits = $derived.by(() =>
		unindexed(this.#deposits, this.#account())
	);
	readonly withdrawals = $derived.by(() =>
		unindexed(this.#withdrawals, this.#account())
	);
	readonly cancelling = $derived(this.#cancels.length > 0);
	readonly completing = $derived(this.#completes.length > 0);
	readonly depositMicroUsd = $derived(total(this.deposits));
	readonly withdrawalMicroUsd = $derived(total(this.withdrawals));

	constructor(account: () => IndexedAccount | undefined) {
		this.#account = account;
	}
}
