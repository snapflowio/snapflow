/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AutoTopUp, UpdateAutoTopUp } from '@snapflow/api-client';
import { client } from '@snapflow/api-client/client.gen';
import {
	type AutoTopUpSetup,
	type Escrow,
	type EscrowExecutorClients,
	type EscrowPublicClient,
	type PasskeySigner,
	SettlementService,
	type SignerLimitRaise,
	type SignerScope,
	type WalletFeeConfirmation,
	WalletService,
} from '@snapflow/sdk';
import { mutationOptions } from '@tanstack/svelte-query';
import { type Address, getAddress, type TransactionReceipt } from 'viem';
import {
	ESCROW_DEPOSIT_MUTATION_KEY,
	ESCROW_QUERY_KEYS,
	ESCROW_WITHDRAWAL_CANCEL_MUTATION_KEY,
	ESCROW_WITHDRAWAL_COMPLETE_MUTATION_KEY,
	ESCROW_WITHDRAWAL_REQUEST_MUTATION_KEY,
} from '#lib/api/settlement/escrow.ts';
import { USDC_BALANCE_QUERY_KEY } from '#lib/integrations/wallet/usdc-balance.ts';
import {
	walletFailure,
	walletMutationFn,
} from '#lib/integrations/wallet/wallet-error.ts';

export type EscrowFunder = EscrowExecutorClients;

export type EscrowFunderSource = () => Promise<EscrowFunder>;

interface EscrowFunderOnly {
	funder: EscrowFunderSource;
}

export interface EscrowAmount extends EscrowFunderOnly {
	amount: bigint;
}

export interface EscrowDepositFor extends EscrowAmount {
	customer: Address;
}

export const FundingDepositStep = {
	Deposit: 'deposit',
	AutomaticPayments: 'automatic-payments',
	Batched: 'batched',
} as const;

export type FundingDepositStep =
	(typeof FundingDepositStep)[keyof typeof FundingDepositStep];

export interface AutomaticPaymentsGrant extends EscrowFunderOnly {
	scope: SignerScope;
	batched: boolean;
}

export interface FundingDeposit extends EscrowDepositFor {
	automaticPayments: AutomaticPaymentsGrant | null;
	onStep: (step: FundingDepositStep) => void;
}

interface AutoTopUpChange extends EscrowFunderOnly {
	settings: UpdateAutoTopUp;
	allowance: bigint;
}

interface SignerAuthorizationChange extends EscrowFunderOnly {
	scope: SignerScope;
}

interface SignerChange extends EscrowFunderOnly {
	signer: Address;
}

interface SignerLimitRaiseChange extends SignerChange {
	raise: SignerLimitRaise;
}

interface SignerLimitLowerChange extends SignerChange {
	hourlyCap: SignerLimitRaise['hourlyCap'];
}

const INDEXING_NOTE = 'It shows here once Snapflow indexes the block.';

const settlement = new SettlementService(client);
const wallets = new WalletService(client);

function autoTopUpSetup(terms: AutoTopUp, allowance: bigint): AutoTopUpSetup {
	return {
		limits: {
			relayer: getAddress(terms.relayerAddress),
			amount: BigInt(terms.amount),
			threshold: BigInt(terms.threshold),
			maxRelayFee: BigInt(terms.maxRelayFee),
			minInterval: terms.minInterval,
		},
		allowance,
	};
}

async function escrowOf(funder: EscrowFunderSource): Promise<Escrow> {
	return settlement.escrow(await funder());
}

export async function safeEscrowFunder(
	signer: PasskeySigner,
	publicClient: EscrowPublicClient,
	confirmFee: WalletFeeConfirmation
): Promise<EscrowFunder> {
	return {
		executor: await wallets.escrowExecutor(signer, publicClient, {
			confirmFee,
		}),
		publicClient,
	};
}

async function depositWithAutomaticPayments({
	funder,
	customer,
	amount,
	automaticPayments,
	onStep,
}: FundingDeposit): Promise<TransactionReceipt> {
	if (!automaticPayments) {
		onStep(FundingDepositStep.Deposit);
		return (await escrowOf(funder)).depositFor(customer, amount);
	}
	const { scope } = automaticPayments;
	if (automaticPayments.batched) {
		onStep(FundingDepositStep.Batched);
		const clients = await funder();
		const hashes = await settlement.setUpDelegatedPayments(
			await settlement.escrow(clients),
			{ deposit: amount, signerScope: scope }
		);
		const hash = hashes.at(-1);
		if (!hash) throw new Error('The deposit sent no transaction');
		return clients.publicClient.getTransactionReceipt({ hash });
	}
	onStep(FundingDepositStep.Deposit);
	const receipt = await (await escrowOf(funder)).depositFor(customer, amount);
	onStep(FundingDepositStep.AutomaticPayments);
	await settlement.authorizeDelegatedSigner(
		await escrowOf(automaticPayments.funder),
		scope
	);
	return receipt;
}

export function escrowDepositMutationOptions() {
	return mutationOptions({
		mutationKey: ESCROW_DEPOSIT_MUTATION_KEY,
		mutationFn: walletMutationFn(depositWithAutomaticPayments),
		meta: {
			failure: walletFailure('The deposit failed'),
			invalidates: [...ESCROW_QUERY_KEYS, USDC_BALANCE_QUERY_KEY],
		},
	});
}

export function requestWithdrawalMutationOptions() {
	return mutationOptions({
		mutationKey: ESCROW_WITHDRAWAL_REQUEST_MUTATION_KEY,
		mutationFn: walletMutationFn(async ({ funder, amount }: EscrowAmount) =>
			(await escrowOf(funder)).requestWithdrawal(amount)
		),
		meta: {
			failure: walletFailure('The withdrawal could not be requested'),
			invalidates: ESCROW_QUERY_KEYS,
		},
	});
}

export function cancelWithdrawalMutationOptions() {
	return mutationOptions({
		mutationKey: ESCROW_WITHDRAWAL_CANCEL_MUTATION_KEY,
		mutationFn: walletMutationFn(async ({ funder }: EscrowFunderOnly) =>
			(await escrowOf(funder)).cancelWithdrawal()
		),
		meta: {
			failure: walletFailure('The withdrawal could not be cancelled'),
			invalidates: ESCROW_QUERY_KEYS,
		},
	});
}

export function completeWithdrawalMutationOptions() {
	return mutationOptions({
		mutationKey: ESCROW_WITHDRAWAL_COMPLETE_MUTATION_KEY,
		mutationFn: walletMutationFn(async ({ funder }: EscrowFunderOnly) =>
			(await escrowOf(funder)).completeWithdrawal()
		),
		meta: {
			success: 'Withdrawal sent to your funding wallet',
			failure: walletFailure('The withdrawal could not be completed'),
			invalidates: [...ESCROW_QUERY_KEYS, USDC_BALANCE_QUERY_KEY],
		},
	});
}

export function enableAutoTopUpMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(
			async ({ funder, settings, allowance }: AutoTopUpChange) => {
				const escrow = await escrowOf(funder);
				const terms = await settlement.updateAutoTopUp(settings);
				await escrow.enableAutoTopUp(autoTopUpSetup(terms, allowance));
				return terms;
			}
		),
		meta: {
			success: `Auto top-up is on. ${INDEXING_NOTE}`,
			failure: walletFailure('Auto top-up could not be turned on'),
			invalidates: [...ESCROW_QUERY_KEYS, USDC_BALANCE_QUERY_KEY],
		},
	});
}

export function disableAutoTopUpMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(async ({ funder }: EscrowFunderOnly) => {
			const escrow = await escrowOf(funder);
			const current = await settlement.autoTopUp();
			const terms = await settlement.updateAutoTopUp({
				enabled: false,
				amount: current.amount,
				threshold: current.threshold,
				maxRelayFee: current.maxRelayFee,
				timesPerDay: current.timesPerDay,
			});
			if (current.limits !== null) await escrow.disableAutoTopUp();
			return terms;
		}),
		meta: {
			success: 'Auto top-up is off',
			failure: walletFailure('Auto top-up could not be turned off'),
			invalidates: ESCROW_QUERY_KEYS,
		},
	});
}

export function delegatedSignerMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(
			async ({ funder, scope }: SignerAuthorizationChange) =>
				settlement.authorizeDelegatedSigner(await escrowOf(funder), scope)
		),
		meta: {
			success: `Automatic payments are on. ${INDEXING_NOTE}`,
			failure: walletFailure('Automatic payments could not be turned on'),
			invalidates: ESCROW_QUERY_KEYS,
		},
	});
}

export function raiseSignerLimitMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(
			async ({ funder, signer, raise }: SignerLimitRaiseChange) =>
				(await escrowOf(funder)).raiseSignerLimit(signer, raise)
		),
		meta: {
			success: `Hourly spending limit raised. ${INDEXING_NOTE}`,
			failure: walletFailure('The hourly spending limit could not be raised'),
			invalidates: ESCROW_QUERY_KEYS,
		},
	});
}

export function lowerSignerLimitMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(
			async ({ funder, signer, hourlyCap }: SignerLimitLowerChange) =>
				(await escrowOf(funder)).lowerSignerLimit(signer, hourlyCap)
		),
		meta: {
			success: `Lower hourly spending limit scheduled. ${INDEXING_NOTE}`,
			failure: walletFailure('The hourly spending limit could not be lowered'),
			invalidates: ESCROW_QUERY_KEYS,
		},
	});
}

export function thawSignerMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(async ({ funder, signer }: SignerChange) =>
			(await escrowOf(funder)).thawSigner(signer)
		),
		meta: {
			success: `Automatic payments are stopping. ${INDEXING_NOTE}`,
			failure: walletFailure('Automatic payments could not be stopped'),
			invalidates: ESCROW_QUERY_KEYS,
		},
	});
}

export function revokeSignerMutationOptions() {
	return mutationOptions({
		mutationFn: walletMutationFn(async ({ funder, signer }: SignerChange) =>
			(await escrowOf(funder)).revokeSigner(signer)
		),
		meta: {
			success: `Automatic payments key revoked. ${INDEXING_NOTE}`,
			failure: walletFailure('The automatic payments key could not be revoked'),
			invalidates: ESCROW_QUERY_KEYS,
		},
	});
}
