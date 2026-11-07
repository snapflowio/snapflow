/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	readUsdcAllowance,
	simulateSnapflowEscrowDepositFor,
	simulateUsdcApprove,
	writeSnapflowEscrowDepositFor,
	writeUsdcApprove,
} from '@snapflow/contracts/actions';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { type Address, getAddress } from 'viem';
import { ESCROW_QUERY_KEYS } from '#lib/api/settlement/escrow.ts';
import {
	confirmTransaction,
	type EscrowWallet,
} from '#lib/features/billing/lib/escrow-wallet.ts';
import { walletCall } from '#lib/features/billing/lib/wallet-error.ts';
import {
	USDC_BALANCE_QUERY_KEY,
	usdcBalanceQueryOptions,
} from '#lib/features/billing/lib/wallet-queries.ts';
import { formatMicroUsd, usdInputToMicroUsd } from '#lib/utils/usd.ts';

type DepositStage = 'approving' | 'depositing';

interface DepositRequest {
	wallet: EscrowWallet;
	customer: Address;
	amount: bigint;
}

const INVALID_AMOUNT_MESSAGE = 'Enter a USDC amount, like 50 or 12.50.';
const ABOVE_BALANCE_MESSAGE = 'This is more USDC than the wallet holds.';

export class EscrowDeposit {
	readonly #wallet: () => EscrowWallet | null;
	readonly #fundingAddress: () => string | null;
	amount = $state('');
	stage = $state<DepositStage | null>(null);

	readonly balance;
	readonly mutation;
	readonly units = $derived.by(() => {
		const microUsd = usdInputToMicroUsd(this.amount);
		return microUsd === null ? null : BigInt(microUsd);
	});
	readonly error = $derived.by(() => {
		if (this.amount.trim() === '') return null;
		if (this.units === null) return INVALID_AMOUNT_MESSAGE;
		const held = this.balance.data;
		return held !== undefined && this.units > held
			? ABOVE_BALANCE_MESSAGE
			: null;
	});
	readonly hint = $derived.by(() =>
		this.balance.data === undefined
			? 'USDC moves from the connected wallet into the escrow.'
			: `The connected wallet holds ${formatMicroUsd(this.balance.data.toString())} USDC.`
	);

	readonly ready = $derived.by(
		() =>
			this.#wallet() !== null &&
			this.#fundingAddress() !== null &&
			this.units !== null &&
			this.error === null &&
			!this.mutation.isPending
	);

	constructor(
		wallet: () => EscrowWallet | null,
		fundingAddress: () => string | null
	) {
		this.#wallet = wallet;
		this.#fundingAddress = fundingAddress;
		this.balance = createQuery(() => usdcBalanceQueryOptions(this.#wallet()));
		this.mutation = createMutation(() => ({
			mutationFn: async ({ wallet, customer, amount }: DepositRequest) => {
				const allowance = await walletCall(() =>
					readUsdcAllowance(wallet.config, {
						address: wallet.usdc,
						args: [wallet.account, wallet.escrow],
						chainId: wallet.chainId,
					})
				);
				if (allowance < amount) {
					this.stage = 'approving';
					await confirmTransaction(wallet, async () => {
						const { request } = await simulateUsdcApprove(wallet.config, {
							address: wallet.usdc,
							args: [wallet.escrow, amount],
							account: wallet.account,
							chainId: wallet.chainId,
						});
						return writeUsdcApprove(wallet.config, request);
					});
				}
				this.stage = 'depositing';
				return confirmTransaction(wallet, async () => {
					const { request } = await simulateSnapflowEscrowDepositFor(
						wallet.config,
						{
							address: wallet.escrow,
							args: [customer, amount],
							account: wallet.account,
							chainId: wallet.chainId,
						}
					);
					return writeSnapflowEscrowDepositFor(wallet.config, request);
				});
			},
			onSuccess: () => {
				this.amount = '';
			},
			onSettled: () => {
				this.stage = null;
			},
			meta: {
				success:
					'Deposit confirmed. The balance updates once Snapflow indexes the block.',
				failure: 'The deposit failed',
				invalidates: [...ESCROW_QUERY_KEYS, USDC_BALANCE_QUERY_KEY],
			},
		}));
	}

	submit = (): void => {
		const wallet = this.#wallet();
		const funding = this.#fundingAddress();
		if (!(this.ready && wallet && funding && this.units !== null)) return;
		this.mutation.mutate({
			wallet,
			customer: getAddress(funding),
			amount: this.units,
		});
	};
}
