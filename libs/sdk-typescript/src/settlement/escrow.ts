/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	type EscrowDomain,
	escrowDomain,
	MAX_RELAY_FEE,
	MIN_AUTO_TOP_UP_INTERVAL,
	signerAvailableAt,
	snapflowEscrowAbi,
} from '@snapflow/contracts';
import {
	type Address,
	type ContractFunctionArgs,
	type ContractFunctionName,
	type EncodeFunctionDataParameters,
	encodeFunctionData,
	erc20Abi,
	type Hash,
	type Hex,
	type TransactionReceipt,
} from 'viem';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import {
	DEPOSIT_AUTHORIZATION_LIFETIME_SECONDS,
	type SignedDepositAuthorization,
	signDepositAuthorization,
} from './deposit-authorization.js';
import { signPermit } from './escrow-permit.js';
import {
	type EscrowClients,
	type EscrowExecutor,
	type EscrowExecutorClients,
	type EscrowPublicClient,
	type EscrowStep,
	type EscrowWalletClient,
	lastReceipt,
	readChain,
	walletExecutor,
} from './escrow-transaction.js';
import type {
	AutoTopUpState,
	EscrowAccountState,
	EscrowAutoTopUpLimits,
	SignerAuthorization,
	SignerGrant,
	SignerLimitRaise,
	SignerScope,
} from './escrow-types.js';
import {
	type SessionKeySource,
	SIGNER_PROOF_LIFETIME_SECONDS,
	sessionKeyAuthorization,
} from './session-key.js';
import { assertFeeBps } from './settlement-fees.js';

type EscrowAbi = typeof snapflowEscrowAbi;
type EscrowWriteName = ContractFunctionName<EscrowAbi, 'nonpayable'>;

const NO_RELAY_FEE = 0n;

const SECONDS_PER_DAY = 86_400;

export interface EscrowContracts {
	escrowAddress: Address;
	usdcAddress: Address;
	feeBps: number;
}

export type EscrowOptions = EscrowContracts &
	(EscrowClients | EscrowExecutorClients);

export interface DepositOptions {
	permit?: boolean;
}

export interface DepositAuthorizationOptions {
	customer?: Address;
	lifetimeSeconds?: bigint;
	relayFee?: bigint;
}

export type AutoTopUpFrequency =
	| { minInterval: EscrowAutoTopUpLimits['minInterval']; timesPerDay?: never }
	| { timesPerDay: number; minInterval?: never };

export type AutoTopUpTerms = Omit<
	EscrowAutoTopUpLimits,
	'relayer' | 'minInterval'
> &
	AutoTopUpFrequency;

export type AutoTopUpLimits = AutoTopUpTerms &
	Pick<EscrowAutoTopUpLimits, 'relayer'>;

export interface AutoTopUpSetup {
	limits: AutoTopUpLimits;
	allowance: bigint;
}

export interface EscrowSetup {
	deposit?: bigint;
	signers?: readonly SignerAuthorization[];
	autoTopUp?: AutoTopUpSetup;
}

function assertPositive(amount: bigint, name: string): void {
	if (amount <= 0n) {
		throw new SnapflowValidationError(`${name} must be positive`);
	}
}

function assertValidScope(scope: SignerScope, chargedFeeBps: number): void {
	assertPositive(scope.hourlyCap, 'hourlyCap');
	assertFeeBps(scope.maxFeeBps, 'maxFeeBps');
	if (scope.maxFeeBps > chargedFeeBps) {
		throw new SnapflowValidationError(
			`maxFeeBps ${scope.maxFeeBps} is above the ${chargedFeeBps} basis points Snapflow charges`
		);
	}
}

function assertRelayFee(relayFee: bigint, amount: bigint): void {
	if (relayFee < 0n || relayFee > MAX_RELAY_FEE || relayFee >= amount) {
		throw new SnapflowValidationError(
			`relayFee must be between 0 and ${MAX_RELAY_FEE} and below the amount`
		);
	}
}

export function autoTopUpInterval(timesPerDay: number): number {
	if (!Number.isSafeInteger(timesPerDay) || timesPerDay <= 0) {
		throw new SnapflowValidationError('timesPerDay must be a positive integer');
	}
	return Math.floor(SECONDS_PER_DAY / timesPerDay);
}

function escrowAutoTopUpLimits(limits: AutoTopUpLimits): EscrowAutoTopUpLimits {
	const { relayer, amount, threshold, maxRelayFee } = limits;
	const minInterval =
		limits.timesPerDay === undefined
			? limits.minInterval
			: autoTopUpInterval(limits.timesPerDay);
	assertPositive(amount, 'amount');
	assertPositive(threshold, 'threshold');
	if (
		maxRelayFee < 0n ||
		maxRelayFee > MAX_RELAY_FEE ||
		maxRelayFee >= amount
	) {
		throw new SnapflowValidationError(
			`maxRelayFee must be between 0 and ${MAX_RELAY_FEE} and below the amount`
		);
	}
	if (
		!Number.isSafeInteger(minInterval) ||
		minInterval < MIN_AUTO_TOP_UP_INTERVAL
	) {
		throw new SnapflowValidationError(
			`Auto top-ups must be at least ${MIN_AUTO_TOP_UP_INTERVAL} seconds apart, at most ${SECONDS_PER_DAY / MIN_AUTO_TOP_UP_INTERVAL} times a day`
		);
	}
	return { relayer, amount, threshold, maxRelayFee, minInterval };
}

export class Escrow {
	public readonly escrowAddress: Address;
	public readonly usdcAddress: Address;
	public readonly feeBps: number;
	private readonly publicClient: EscrowPublicClient;
	private readonly executor: EscrowExecutor;
	private readonly walletClient?: EscrowWalletClient;

	constructor(options: EscrowOptions) {
		const executor =
			'executor' in options ? options.executor : walletExecutor(options);
		if (executor.chainId !== options.publicClient.chain.id) {
			throw new SnapflowValidationError(
				`The wallet is on chain ${executor.chainId} but the public client on ${options.publicClient.chain.id}`
			);
		}
		assertFeeBps(options.feeBps, 'feeBps');
		this.escrowAddress = options.escrowAddress;
		this.usdcAddress = options.usdcAddress;
		this.feeBps = options.feeBps;
		this.publicClient = options.publicClient;
		this.executor = executor;
		this.walletClient =
			'walletClient' in options ? options.walletClient : undefined;
	}

	public get chainId(): number {
		return this.publicClient.chain.id;
	}

	public get account(): Address {
		return this.executor.account;
	}

	public get domain(): EscrowDomain {
		return escrowDomain(this.chainId, this.escrowAddress);
	}

	public async deposit(
		amount: bigint,
		options: DepositOptions = {}
	): Promise<TransactionReceipt> {
		assertPositive(amount, 'amount');
		if (options.permit) {
			const walletClient = this.signingWallet('A permit deposit');
			const permit = await readChain(() =>
				signPermit(
					walletClient,
					this.publicClient,
					this.usdcAddress,
					this.escrowAddress,
					amount
				)
			);
			return this.send(
				this.escrowStep('depositWithPermit', [
					amount,
					permit.deadline,
					permit.v,
					permit.r,
					permit.s,
				])
			);
		}
		return this.sendSteps(
			await this.depositSteps(amount, this.escrowStep('deposit', [amount]))
		);
	}

	public depositFor(
		customer: Address,
		amount: bigint
	): Promise<TransactionReceipt> {
		assertPositive(amount, 'amount');
		return this.depositSteps(
			amount,
			this.escrowStep('depositFor', [customer, amount])
		).then((steps) => this.sendSteps(steps));
	}

	public signDepositAuthorization(
		amount: bigint,
		relayer: Address,
		options: DepositAuthorizationOptions = {}
	): Promise<SignedDepositAuthorization> {
		assertPositive(amount, 'amount');
		const relayFee = options.relayFee ?? NO_RELAY_FEE;
		assertRelayFee(relayFee, amount);
		const lifetimeSeconds =
			options.lifetimeSeconds ?? DEPOSIT_AUTHORIZATION_LIFETIME_SECONDS;
		assertPositive(lifetimeSeconds, 'lifetimeSeconds');
		const walletClient = this.signingWallet('A deposit authorization');
		return readChain(() =>
			signDepositAuthorization(walletClient, this.publicClient, {
				escrow: this.domain,
				usdc: this.usdcAddress,
				customer: options.customer ?? this.account,
				relayer,
				amount,
				relayFee,
				lifetimeSeconds,
			})
		);
	}

	public depositWithAuthorization(
		deposit: SignedDepositAuthorization
	): Promise<TransactionReceipt> {
		return this.send(
			this.escrowStep('depositWithAuthorization', [
				deposit.payer,
				deposit.customer,
				deposit.amount,
				deposit.relayFee,
				deposit.validAfter,
				deposit.validBefore,
				deposit.salt,
				deposit.signature,
			])
		);
	}

	public requestWithdrawal(amount: bigint): Promise<TransactionReceipt> {
		assertPositive(amount, 'amount');
		return this.send(this.escrowStep('requestWithdrawal', [amount]));
	}

	public cancelWithdrawal(): Promise<TransactionReceipt> {
		return this.send(this.escrowStep('cancelWithdrawal', []));
	}

	public completeWithdrawal(): Promise<TransactionReceipt> {
		return this.send(this.escrowStep('completeWithdrawal', []));
	}

	public authorizeSigner(
		authorization: SignerAuthorization
	): Promise<TransactionReceipt> {
		assertValidScope(authorization.scope, this.feeBps);
		return this.send(this.signerStep(authorization));
	}

	public async authorizeSessionKey(
		key: SessionKeySource,
		scope: SignerScope
	): Promise<TransactionReceipt> {
		return this.authorizeSigner(await this.sessionKeyAuthorization(key, scope));
	}

	public raiseSignerLimit(
		signer: Address,
		raise: SignerLimitRaise
	): Promise<TransactionReceipt> {
		assertPositive(raise.hourlyCap, 'hourlyCap');
		return this.send(
			this.escrowStep('raiseSignerLimit', [
				signer,
				raise.hourlyCap,
				raise.expiry,
			])
		);
	}

	public lowerSignerLimit(
		signer: Address,
		hourlyCap: SignerLimitRaise['hourlyCap']
	): Promise<TransactionReceipt> {
		assertPositive(hourlyCap, 'hourlyCap');
		return this.send(this.escrowStep('lowerSignerLimit', [signer, hourlyCap]));
	}

	public thawSigner(signer: Address): Promise<TransactionReceipt> {
		return this.send(this.escrowStep('thawSigner', [signer]));
	}

	public revokeSigner(signer: Address): Promise<TransactionReceipt> {
		return this.send(this.escrowStep('revokeSigner', [signer]));
	}

	public enableAutoTopUp(setup: AutoTopUpSetup): Promise<TransactionReceipt> {
		return this.sendSteps(this.autoTopUpSteps(setup));
	}

	public disableAutoTopUp(): Promise<TransactionReceipt> {
		return this.send(this.escrowStep('disableAutoTopUp', []));
	}

	public async depositAndAuthorize(setup: EscrowSetup): Promise<Hash[]> {
		const steps: EscrowStep[] = [];
		if (setup.deposit !== undefined) {
			assertPositive(setup.deposit, 'deposit');
			steps.push(
				...(await this.depositSteps(
					setup.deposit,
					this.escrowStep('deposit', [setup.deposit])
				))
			);
		}
		for (const authorization of setup.signers ?? []) {
			assertValidScope(authorization.scope, this.feeBps);
			steps.push(this.signerStep(authorization));
		}
		if (setup.autoTopUp) {
			steps.push(...this.autoTopUpSteps(setup.autoTopUp));
		}
		if (steps.length === 0) {
			throw new SnapflowValidationError('Nothing to deposit or authorize');
		}
		const receipts = await this.executor.execute(steps);
		return receipts.map((receipt) => receipt.transactionHash);
	}

	public async sessionKeyAuthorization(
		key: SessionKeySource,
		scope: SignerScope
	): Promise<SignerAuthorization> {
		assertValidScope(scope, this.feeBps);
		const block = await readChain(() => this.publicClient.getBlock());
		return sessionKeyAuthorization(
			key,
			this.domain,
			this.account,
			scope,
			block.timestamp + SIGNER_PROOF_LIFETIME_SECONDS
		);
	}

	public readAccount(
		customer: Address = this.account
	): Promise<EscrowAccountState> {
		return readChain(() =>
			this.publicClient.readContract({
				...this.contract,
				functionName: 'accountOf',
				args: [customer],
			})
		);
	}

	public readAvailable(customer: Address = this.account): Promise<bigint> {
		return readChain(() =>
			this.publicClient.readContract({
				...this.contract,
				functionName: 'availableOf',
				args: [customer],
			})
		);
	}

	public readWithdrawalDelay(): Promise<bigint> {
		return readChain(() =>
			this.publicClient.readContract({
				...this.contract,
				functionName: 'withdrawalDelay',
			})
		);
	}

	public readSigner(signer: Address): Promise<SignerGrant> {
		return readChain(() =>
			this.publicClient.readContract({
				...this.contract,
				functionName: 'signerOf',
				args: [signer],
			})
		);
	}

	public async readSignerAvailable(signer: Address): Promise<bigint> {
		const [grant, now] = await Promise.all([
			this.readSigner(signer),
			readChain(() =>
				this.publicClient.readContract({
					...this.contract,
					functionName: 'unfrozenTime',
				})
			),
		]);
		return signerAvailableAt(grant, now);
	}

	public readAutoTopUp(
		customer: Address = this.account
	): Promise<AutoTopUpState> {
		return readChain(() =>
			this.publicClient.readContract({
				...this.contract,
				functionName: 'autoTopUpOf',
				args: [customer],
			})
		);
	}

	public readClaimed(channelId: Hex): Promise<bigint> {
		return readChain(() =>
			this.publicClient.readContract({
				...this.contract,
				functionName: 'claimedOf',
				args: [channelId],
			})
		);
	}

	private get contract() {
		return { address: this.escrowAddress, abi: snapflowEscrowAbi } as const;
	}

	private send(step: EscrowStep): Promise<TransactionReceipt> {
		return this.sendSteps([step]);
	}

	private async sendSteps(
		steps: readonly EscrowStep[]
	): Promise<TransactionReceipt> {
		return lastReceipt(await this.executor.execute([...steps]));
	}

	private signingWallet(action: string): EscrowWalletClient {
		if (!this.walletClient) {
			throw new SnapflowValidationError(
				`${action} needs a connected wallet that signs typed data, not an executor`
			);
		}
		return this.walletClient;
	}

	private escrowStep<const functionName extends EscrowWriteName>(
		functionName: functionName,
		args: ContractFunctionArgs<EscrowAbi, 'nonpayable', functionName>
	): EscrowStep {
		const call = {
			abi: snapflowEscrowAbi,
			functionName,
			args,
		} as EncodeFunctionDataParameters;
		return {
			to: this.escrowAddress,
			data: encodeFunctionData(call),
			abi: snapflowEscrowAbi,
		};
	}

	private signerStep(authorization: SignerAuthorization): EscrowStep {
		return this.escrowStep('authorizeSigner', [
			authorization.signer,
			authorization.scope,
			authorization.proofDeadline,
			authorization.proof,
		]);
	}

	private approvalStep(amount: bigint): EscrowStep {
		return {
			to: this.usdcAddress,
			data: encodeFunctionData({
				abi: erc20Abi,
				functionName: 'approve',
				args: [this.escrowAddress, amount],
			}),
			abi: erc20Abi,
		};
	}

	private autoTopUpSteps({ limits, allowance }: AutoTopUpSetup): EscrowStep[] {
		assertPositive(allowance, 'allowance');
		const { relayer, amount, threshold, maxRelayFee, minInterval } =
			escrowAutoTopUpLimits(limits);
		return [
			this.approvalStep(allowance),
			this.escrowStep('setAutoTopUp', [
				relayer,
				amount,
				threshold,
				maxRelayFee,
				minInterval,
			]),
		];
	}

	private async depositSteps(
		amount: bigint,
		deposit: EscrowStep
	): Promise<EscrowStep[]> {
		const allowance = await readChain(() =>
			this.publicClient.readContract({
				address: this.usdcAddress,
				abi: erc20Abi,
				functionName: 'allowance',
				args: [this.account, this.escrowAddress],
			})
		);
		return allowance >= amount
			? [deposit]
			: [this.approvalStep(amount), deposit];
	}
}
