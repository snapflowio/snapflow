/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	type Address,
	BaseError,
	erc20Abi,
	getAddress,
	type Hash,
	isAddressEqual,
	type PublicClient,
} from 'viem';
import { errorMessage } from '../../../common/utils/error/error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	ESCROW_PENDING,
	type PendingWithdrawalChangeKind,
	SAFE_BLOCK_TAG,
} from '../../constants/escrow.constants';
import { SETTLEMENT_PUBLIC_CLIENT } from '../../constants/settlement.constants';
import type {
	EscrowPendingChangesDto,
	PendingEscrowDepositDto,
	PendingWithdrawalChangeDto,
} from '../../dto/escrow-pending.dto';
import { PaymentWallet } from '../../entities/payment-wallet.entity';
import { SettlementChainCursor } from '../../entities/settlement-chain-cursor.entity';
import { PaymentWalletPurpose } from '../../enums/payment-wallet-purpose.enum';
import { PendingDepositKind } from '../../enums/pending-deposit-kind.enum';
import { PendingDepositStage } from '../../enums/pending-deposit-stage.enum';
import { EscrowPendingUnavailableException } from '../../exceptions/escrow-pending-unavailable.exception';
import { unprocessedDeposits } from '../../queries/unprocessed-deposits.query';
import type { EscrowIdentity } from '../../types/escrow.types';
import { maxBigInt } from '../../utils/escrow/escrow-amount.util';
import { chainTimestamp } from '../../utils/escrow/escrow-event-record.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import { EscrowLogReaderService } from './escrow-log-reader.service';

type ChainDeposit = Omit<PendingEscrowDepositDto, 'requiredConfirmations'>;

interface ChainPendingChanges {
	safeBlock: number;
	deposits: ChainDeposit[];
	withdrawalChanges: PendingWithdrawalChangeDto[];
}

interface CachedChanges {
	expiresAt: number;
	changes: Promise<ChainPendingChanges>;
}

interface PendingRange {
	wallet: Address;
	fromBlock: bigint;
	toBlock: bigint;
}

interface PendingLog {
	blockNumber: bigint;
	transactionHash: Hash;
	logIndex: number;
}

interface PendingWithdrawalLog extends PendingLog {
	args: { amount: bigint };
}

const NO_WALLET = '';

function logKey(log: Pick<PendingLog, 'transactionHash' | 'logIndex'>): string {
	return [log.transactionHash, log.logIndex].join(
		ESCROW_PENDING.CACHE_KEY_SEPARATOR
	);
}

function newestFirst(
	first: Pick<PendingEscrowDepositDto, 'blockNumber' | 'logIndex'>,
	second: Pick<PendingEscrowDepositDto, 'blockNumber' | 'logIndex'>
): number {
	return (
		second.blockNumber - first.blockNumber || second.logIndex - first.logIndex
	);
}

function newestLogFirst(first: PendingLog, second: PendingLog): number {
	if (first.blockNumber !== second.blockNumber) {
		return first.blockNumber < second.blockNumber ? 1 : -1;
	}
	return second.logIndex - first.logIndex;
}

function confirmationsAt(latestBlock: bigint, blockNumber: bigint): number {
	return Number(maxBigInt(0n, latestBlock - blockNumber + 1n));
}

@Injectable()
export class EscrowPendingService {
	private readonly logger = new Logger(EscrowPendingService.name);
	private readonly cache = new Map<string, CachedChanges>();

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		private readonly config: TypedConfigService,
		private readonly settings: SettingsService,
		private readonly logs: EscrowLogReaderService
	) {}

	async changes(organizationId: string): Promise<EscrowPendingChangesDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const [wallet, cursor, settings, latestBlock] = await Promise.all([
			manager.findOne(
				PaymentWallet,
				{ organizationId, purpose: PaymentWalletPurpose.FUNDING },
				{ fields: ['address'] }
			),
			manager.findOne(SettlementChainCursor, escrow),
			this.settings.get(),
			this.fromChain(() => this.client.getBlockNumber()),
		]);
		const indexedThroughBlock = cursor?.lastIndexedBlock ?? null;
		const range = wallet
			? this.pendingRange(wallet.address, indexedThroughBlock, latestBlock)
			: null;
		const [chain, unprocessed] = await Promise.all([
			this.cached(
				[
					escrow.contractAddress,
					wallet?.address ?? NO_WALLET,
					range?.fromBlock ?? latestBlock,
					latestBlock,
				].join(ESCROW_PENDING.CACHE_KEY_SEPARATOR),
				() => this.readChain(escrow, range, latestBlock)
			),
			wallet ? unprocessedDeposits(manager, escrow, organizationId) : [],
		]);
		const confirming = chain.deposits.map(
			(deposit): PendingEscrowDepositDto => ({
				...deposit,
				requiredConfirmations: settings.settlementConfirmations,
			})
		);
		const finalizing = unprocessed.map(
			(event): PendingEscrowDepositDto => ({
				kind: PendingDepositKind.ESCROW,
				stage: PendingDepositStage.FINALIZING,
				transactionHash: event.transactionHash,
				logIndex: event.logIndex,
				payerAddress: getAddress(event.args.payer),
				amountMicroUsd: event.args.amount,
				blockNumber: event.blockNumber,
				blockTimestamp: event.blockTimestamp,
				confirmations: confirmationsAt(latestBlock, BigInt(event.blockNumber)),
				requiredConfirmations: settings.largeDepositConfirmations,
			})
		);
		const finalizingKeys = new Set(finalizing.map(logKey));
		return {
			latestBlock: Number(latestBlock),
			safeBlock: chain.safeBlock,
			indexedThroughBlock,
			observedAt: new Date(),
			deposits: [
				...finalizing,
				...confirming.filter((deposit) => !finalizingKeys.has(logKey(deposit))),
			].sort(newestFirst),
			withdrawalChanges: chain.withdrawalChanges,
		};
	}

	private pendingRange(
		wallet: Address,
		indexedThroughBlock: number | null,
		latestBlock: bigint
	): PendingRange | null {
		const firstUnindexed =
			indexedThroughBlock === null
				? BigInt(this.config.get('settlement.escrowDeploymentBlock'))
				: BigInt(indexedThroughBlock) + 1n;
		const fromBlock = maxBigInt(
			firstUnindexed,
			latestBlock - this.logs.maximumBlocks + 1n
		);
		if (fromBlock > latestBlock) return null;
		return { wallet, fromBlock, toBlock: latestBlock };
	}

	private cached(
		key: string,
		read: () => Promise<ChainPendingChanges>
	): Promise<ChainPendingChanges> {
		const now = Date.now();
		for (const [cachedKey, entry] of this.cache) {
			if (entry.expiresAt <= now) this.cache.delete(cachedKey);
		}
		const hit = this.cache.get(key);
		if (hit) return hit.changes;
		const changes = read().catch((error: unknown) => {
			this.cache.delete(key);
			throw error;
		});
		this.cache.set(key, {
			expiresAt: now + ESCROW_PENDING.CACHE_MILLISECONDS,
			changes,
		});
		return changes;
	}

	private readChain(
		escrow: EscrowIdentity,
		range: PendingRange | null,
		latestBlock: bigint
	): Promise<ChainPendingChanges> {
		return this.fromChain(async () => {
			const [safe, logs] = await Promise.all([
				this.client.getBlock({ blockTag: SAFE_BLOCK_TAG }),
				range ? this.readLogs(escrow, range) : null,
			]);
			if (!logs) {
				return {
					safeBlock: Number(safe.number),
					deposits: [],
					withdrawalChanges: [],
				};
			}
			const timestamps = await this.blockTimestamps([
				...logs.deposits,
				...logs.transfers,
				...logs.withdrawals.flatMap(([, entries]) => entries),
			]);
			const at = (log: PendingLog): Date => {
				const timestamp = timestamps.get(log.blockNumber);
				if (timestamp === undefined) {
					throw new Error(`Block ${log.blockNumber} has no timestamp`);
				}
				return timestamp;
			};
			const deposits: ChainDeposit[] = [
				...logs.deposits.map(
					(log): ChainDeposit => ({
						kind: PendingDepositKind.ESCROW,
						stage: PendingDepositStage.CONFIRMING,
						transactionHash: log.transactionHash,
						logIndex: log.logIndex,
						payerAddress: log.args.payer,
						amountMicroUsd: log.args.amount.toString(),
						blockNumber: Number(log.blockNumber),
						blockTimestamp: at(log),
						confirmations: confirmationsAt(latestBlock, log.blockNumber),
					})
				),
				...logs.transfers
					.filter(
						(log) => !isAddressEqual(log.args.from, escrow.contractAddress)
					)
					.map(
						(log): ChainDeposit => ({
							kind: PendingDepositKind.WALLET,
							stage: PendingDepositStage.CONFIRMING,
							transactionHash: log.transactionHash,
							logIndex: log.logIndex,
							payerAddress: log.args.from,
							amountMicroUsd: log.args.value.toString(),
							blockNumber: Number(log.blockNumber),
							blockTimestamp: at(log),
							confirmations: confirmationsAt(latestBlock, log.blockNumber),
						})
					),
			];
			const withdrawalChanges = logs.withdrawals
				.flatMap(([kind, entries]) => entries.map((log) => ({ kind, log })))
				.sort((first, second) => newestLogFirst(first.log, second.log))
				.map(
					({ kind, log }): PendingWithdrawalChangeDto => ({
						kind,
						transactionHash: log.transactionHash,
						amountMicroUsd: log.args.amount.toString(),
						blockNumber: Number(log.blockNumber),
						blockTimestamp: at(log),
					})
				);
			return {
				safeBlock: Number(safe.number),
				deposits,
				withdrawalChanges,
			};
		});
	}

	private async readLogs(escrow: EscrowIdentity, range: PendingRange) {
		const window = { fromBlock: range.fromBlock, toBlock: range.toBlock };
		const account = { account: range.wallet };
		const escrowEvents = {
			address: escrow.contractAddress,
			abi: snapflowEscrowAbi,
			strict: true,
		} as const;
		const [deposits, transfers, requested, cancelled, withdrawn] =
			await Promise.all([
				this.logs.read(window, (page) =>
					this.client.getContractEvents({
						...escrowEvents,
						...page,
						eventName: 'Deposited',
						args: { customer: range.wallet },
					})
				),
				this.logs.read(window, (page) =>
					this.client.getContractEvents({
						address: this.config.get('settlement.usdcAddress'),
						abi: erc20Abi,
						eventName: 'Transfer',
						args: { to: range.wallet },
						strict: true,
						...page,
					})
				),
				this.logs.read(window, (page) =>
					this.client.getContractEvents({
						...escrowEvents,
						...page,
						eventName: 'WithdrawalRequested',
						args: account,
					})
				),
				this.logs.read(window, (page) =>
					this.client.getContractEvents({
						...escrowEvents,
						...page,
						eventName: 'WithdrawalCancelled',
						args: account,
					})
				),
				this.logs.read(window, (page) =>
					this.client.getContractEvents({
						...escrowEvents,
						...page,
						eventName: 'Withdrawn',
						args: account,
					})
				),
			]);
		const withdrawals: [
			PendingWithdrawalChangeKind,
			readonly PendingWithdrawalLog[],
		][] = [
			['WithdrawalRequested', requested],
			['WithdrawalCancelled', cancelled],
			['Withdrawn', withdrawn],
		];
		return { deposits, transfers, withdrawals };
	}

	private async blockTimestamps(
		logs: readonly PendingLog[]
	): Promise<Map<bigint, Date>> {
		const blockNumbers = [...new Set(logs.map((log) => log.blockNumber))];
		const blocks = await Promise.all(
			blockNumbers.map((blockNumber) => this.client.getBlock({ blockNumber }))
		);
		return new Map(
			blocks.map((block) => [block.number, chainTimestamp(block.timestamp)])
		);
	}

	private async fromChain<T>(work: () => Promise<T>): Promise<T> {
		try {
			return await work();
		} catch (error) {
			if (!(error instanceof BaseError)) throw error;
			this.logger.warn(
				`Could not read pending escrow changes from the settlement chain: ${errorMessage(error)}`
			);
			throw new EscrowPendingUnavailableException(error);
		}
	}
}
