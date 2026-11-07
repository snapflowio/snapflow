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
	simulateSnapflowEscrowCancelWithdrawal,
	simulateSnapflowEscrowRequestWithdrawal,
	simulateSnapflowEscrowWithdraw,
	writeSnapflowEscrowCancelWithdrawal,
	writeSnapflowEscrowRequestWithdrawal,
	writeSnapflowEscrowWithdraw,
} from '@snapflow/contracts/actions';
import { createMutation } from '@tanstack/svelte-query';
import { ESCROW_QUERY_KEYS } from '#lib/api/settlement/escrow.ts';
import {
	confirmTransaction,
	type EscrowWallet,
} from '#lib/features/billing/lib/escrow-wallet.ts';
import { USDC_BALANCE_QUERY_KEY } from '#lib/features/billing/lib/wallet-queries.ts';
import { usdInputToMicroUsd } from '#lib/utils/usd.ts';
import { Clock } from './clock.svelte.ts';

interface WithdrawalRequest {
	wallet: EscrowWallet;
	amount: bigint;
}

const COUNTDOWN_TICK_MILLISECONDS = 1_000;
const INVALID_AMOUNT_MESSAGE = 'Enter a USDC amount, like 50 or 12.50.';
const ABOVE_BALANCE_MESSAGE = 'This is more than the escrow holds for you.';
const INDEXING_NOTE = 'It shows here once Snapflow indexes the block.';

export class EscrowWithdrawal {
	readonly #account: () => EscrowAccount;
	readonly #clock = new Clock(COUNTDOWN_TICK_MILLISECONDS);
	amount = $state('');

	readonly request;
	readonly cancel;
	readonly complete;

	readonly units = $derived.by(() => {
		const microUsd = usdInputToMicroUsd(this.amount);
		return microUsd === null ? null : BigInt(microUsd);
	});
	readonly error = $derived.by(() => {
		if (this.amount.trim() === '') return null;
		if (this.units === null) return INVALID_AMOUNT_MESSAGE;
		return this.units > BigInt(this.#account().balanceMicroUsd)
			? ABOVE_BALANCE_MESSAGE
			: null;
	});
	readonly pending = $derived.by(
		() => BigInt(this.#account().pendingWithdrawalMicroUsd) > 0n
	);
	readonly remainingMilliseconds = $derived.by(() => {
		const readyAt = this.#account().withdrawalReadyAt;
		if (!(this.pending && readyAt)) return null;
		return Math.max(0, new Date(readyAt).getTime() - this.#clock.now);
	});
	readonly withdrawable = $derived(this.remainingMilliseconds === 0);
	readonly busy = $derived.by(
		() =>
			this.request.isPending || this.cancel.isPending || this.complete.isPending
	);

	constructor(account: () => EscrowAccount) {
		this.#account = account;
		this.request = createMutation(() => ({
			mutationFn: ({ wallet, amount }: WithdrawalRequest) =>
				confirmTransaction(wallet, async () => {
					const { request } = await simulateSnapflowEscrowRequestWithdrawal(
						wallet.config,
						{
							address: wallet.escrow,
							args: [amount],
							account: wallet.account,
							chainId: wallet.chainId,
						}
					);
					return writeSnapflowEscrowRequestWithdrawal(wallet.config, request);
				}),
			onSuccess: () => {
				this.amount = '';
			},
			meta: {
				success: `Withdrawal requested. ${INDEXING_NOTE}`,
				failure: 'The withdrawal request failed',
				invalidates: ESCROW_QUERY_KEYS,
			},
		}));
		this.cancel = createMutation(() => ({
			mutationFn: (wallet: EscrowWallet) =>
				confirmTransaction(wallet, async () => {
					const { request } = await simulateSnapflowEscrowCancelWithdrawal(
						wallet.config,
						{
							address: wallet.escrow,
							account: wallet.account,
							chainId: wallet.chainId,
						}
					);
					return writeSnapflowEscrowCancelWithdrawal(wallet.config, request);
				}),
			meta: {
				success: `Withdrawal cancelled. ${INDEXING_NOTE}`,
				failure: 'The withdrawal could not be cancelled',
				invalidates: ESCROW_QUERY_KEYS,
			},
		}));
		this.complete = createMutation(() => ({
			mutationFn: (wallet: EscrowWallet) =>
				confirmTransaction(wallet, async () => {
					const { request } = await simulateSnapflowEscrowWithdraw(
						wallet.config,
						{
							address: wallet.escrow,
							account: wallet.account,
							chainId: wallet.chainId,
						}
					);
					return writeSnapflowEscrowWithdraw(wallet.config, request);
				}),
			meta: {
				success: `Withdrawal sent to your wallet. ${INDEXING_NOTE}`,
				failure: 'The withdrawal failed',
				invalidates: [...ESCROW_QUERY_KEYS, USDC_BALANCE_QUERY_KEY],
			},
		}));
	}

	submitRequest = (wallet: EscrowWallet): void => {
		if (this.units === null || this.error !== null || this.busy) return;
		this.request.mutate({ wallet, amount: this.units });
	};
}
