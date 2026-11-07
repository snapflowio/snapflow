/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	type Hash,
	type PublicClient,
	TransactionNotFoundError,
	TransactionReceiptNotFoundError,
	WaitForTransactionReceiptTimeoutError,
} from 'viem';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	CLAIM_RELAYER,
	ClaimFailure,
} from '../../constants/payment-channel.constants';
import {
	SETTLEMENT_PUBLIC_CLIENT,
	SETTLEMENT_RELAYER_WALLET,
} from '../../constants/settlement.constants';
import { PaymentChannel } from '../../entities/payment-channel.entity';
import type { RelayerWallet } from '../../providers/relayer-wallet.provider';
import { claimableChannels } from '../../queries/claimable-channels.query';
import { claimedAmounts } from '../../queries/claimed-amounts.query';
import {
	latestVouchers,
	VoucherSelection,
} from '../../queries/latest-vouchers.query';
import type { EscrowIdentity } from '../../types/escrow.types';
import type { ChannelVoucher } from '../../types/payment-channel.types';
import {
	contractRevertReason,
	isChainUnreachable,
} from '../../utils/chain-error.util';
import {
	type ClaimCandidate,
	isolateClaimable,
	type RejectedClaim,
	selectClaims,
} from '../../utils/claim-selection.util';
import { configuredEscrow } from '../../utils/escrow-identity.util';
import {
	storedAmounts,
	ZERO_VOUCHER_AMOUNTS,
} from '../../utils/voucher-amounts.util';
import { signedVoucher } from '../../utils/voucher-message.util';

type RelayCandidate = ClaimCandidate & ChannelVoucher;

const TRANSACTION_PENDING = 'pending';

type TransactionOutcome = ClaimFailure | null | typeof TRANSACTION_PENDING;

// Claims the latest signed vouchers in batches with Snapflow's gas wallet.
// One batch at a time: a run first settles the batch in flight and sends
// nothing while it is pending. The indexer posts what the batch paid once
// its Claimed events are confirmed.
@Injectable()
export class ClaimRelayerService extends TrackedJobs {
	protected readonly logger = new Logger(ClaimRelayerService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(SETTLEMENT_PUBLIC_CLIENT) private readonly client: PublicClient,
		@Inject(SETTLEMENT_RELAYER_WALLET) private readonly wallet: RelayerWallet,
		private readonly config: TypedConfigService,
		private readonly settings: SettingsService,
		private readonly locks: RedisLockProvider
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(CLAIM_RELAYER.JOB)
	@CreateRequestContext()
	async relayClaims(): Promise<void> {
		await this.locks.runExclusive(
			CLAIM_RELAYER.JOB,
			CLAIM_RELAYER.LOCK_TTL_SECONDS,
			async () => {
				try {
					await this.relay(configuredEscrow(this.config));
				} catch (error) {
					this.logger.error(
						'Relaying voucher claims failed; retrying on the next run',
						error
					);
				}
			}
		);
	}

	private async relay(escrow: EscrowIdentity): Promise<void> {
		if (await this.settleInFlight(escrow)) return;
		const { claimIntervalMinutes } = await this.settings.get();
		const now = await databaseNow(this.entityManager.fork());
		const candidates = selectClaims(
			await this.candidates(escrow, now),
			now,
			claimIntervalMinutes * MILLISECONDS_PER_MINUTE,
			CLAIM_RELAYER.MAXIMUM_BATCH_SIZE
		);
		const { accepted, rejected } = await isolateClaimable(candidates, (batch) =>
			this.simulate(escrow, batch)
		);
		await this.recordRejections(rejected, now);
		if (accepted.length > 0) await this.send(escrow, accepted, now);
	}

	private async candidates(
		escrow: EscrowIdentity,
		now: Date
	): Promise<RelayCandidate[]> {
		const manager = this.entityManager.fork();
		const channels = await claimableChannels(manager, escrow, now);
		const latest = await latestVouchers(
			manager,
			channels.map(({ id }) => id),
			VoucherSelection.SIGNED
		);
		const paid = await claimedAmounts(
			manager,
			escrow,
			channels.map(({ channelId }) => channelId)
		);
		return channels.flatMap((channel) => {
			const voucher = latest.get(channel.id);
			if (!voucher?.claimableUntil) return [];
			return [
				{
					channel,
					voucher,
					amounts: storedAmounts(voucher),
					paid: paid.get(channel.channelId) ?? ZERO_VOUCHER_AMOUNTS,
					claimableUntil: voucher.claimableUntil,
					lastAttemptAt: channel.claimAttemptedAt ?? channel.openedAt,
				},
			];
		});
	}

	private async simulate(
		escrow: EscrowIdentity,
		batch: readonly RelayCandidate[]
	): Promise<string | null> {
		try {
			await this.simulateBatch(escrow, batch);
			return null;
		} catch (error) {
			if (isChainUnreachable(error)) throw error;
			return contractRevertReason(error);
		}
	}

	private simulateBatch(
		escrow: EscrowIdentity,
		batch: readonly RelayCandidate[]
	) {
		return this.client.simulateContract({
			account: this.wallet.account,
			address: escrow.contractAddress,
			abi: snapflowEscrowAbi,
			functionName: 'claimBatch',
			args: [
				batch.map(({ channel, voucher }) => signedVoucher(channel, voucher)),
			],
		});
	}

	private async send(
		escrow: EscrowIdentity,
		batch: readonly RelayCandidate[],
		now: Date
	): Promise<void> {
		const { request } = await this.simulateBatch(escrow, batch);
		const hash = await this.wallet.writeContract(request);
		const sequences = new Map(
			batch.map(({ channel, voucher }) => [channel.id, voucher.sequence])
		);
		await this.updateChannels([...sequences.keys()], (channel) => {
			channel.claimTransactionHash = hash;
			channel.claimSequence = sequences.get(channel.id) ?? null;
			channel.claimAttemptedAt = now;
			channel.claimError = null;
		});
		try {
			const receipt = await this.client.waitForTransactionReceipt({
				hash,
				timeout: CLAIM_RELAYER.RECEIPT_TIMEOUT_MILLISECONDS,
			});
			await this.settle(
				hash,
				receipt.status === 'success' ? null : ClaimFailure.BATCH_REVERTED
			);
		} catch (error) {
			if (!(error instanceof WaitForTransactionReceiptTimeoutError)) {
				throw error;
			}
			this.logger.warn(
				`Claim batch ${hash} is not mined yet; a later run settles it`
			);
		}
	}

	// Returns true while the batch sent earlier is still pending.
	private async settleInFlight(escrow: EscrowIdentity): Promise<boolean> {
		const inFlight = await this.entityManager
			.fork()
			.find(
				PaymentChannel,
				{ ...escrow, claimTransactionHash: { $ne: null } },
				{ fields: ['claimTransactionHash'] }
			);
		const hashes = new Set(
			inFlight.flatMap(({ claimTransactionHash }) =>
				claimTransactionHash ? [claimTransactionHash] : []
			)
		);
		for (const hash of hashes) {
			const outcome = await this.transactionOutcome(hash);
			if (outcome === TRANSACTION_PENDING) return true;
			await this.settle(hash, outcome);
		}
		return false;
	}

	private async transactionOutcome(hash: Hash): Promise<TransactionOutcome> {
		try {
			const receipt = await this.client.getTransactionReceipt({ hash });
			return receipt.status === 'success' ? null : ClaimFailure.BATCH_REVERTED;
		} catch (error) {
			if (!(error instanceof TransactionReceiptNotFoundError)) throw error;
		}
		try {
			await this.client.getTransaction({ hash });
			return TRANSACTION_PENDING;
		} catch (error) {
			if (error instanceof TransactionNotFoundError) {
				return ClaimFailure.TRANSACTION_DROPPED;
			}
			throw error;
		}
	}

	private async settle(
		hash: Hash,
		failure: ClaimFailure | null
	): Promise<void> {
		const manager = this.entityManager.fork();
		const channels = await manager.find(PaymentChannel, {
			claimTransactionHash: hash,
		});
		for (const channel of channels) {
			if (failure === null && channel.claimSequence !== null) {
				channel.claimedSequence = channel.claimSequence;
			}
			channel.claimError = failure;
			channel.claimTransactionHash = null;
			channel.claimSequence = null;
		}
		await manager.flush();
		if (failure !== null) {
			this.logger.warn(`Claim batch ${hash} failed: ${failure}`);
		}
	}

	private async recordRejections(
		rejected: readonly RejectedClaim<RelayCandidate>[],
		now: Date
	): Promise<void> {
		const reasons = new Map(
			rejected.map(({ candidate, reason }) => [candidate.channel.id, reason])
		);
		await this.updateChannels([...reasons.keys()], (channel) => {
			channel.claimError = reasons.get(channel.id) ?? null;
			channel.claimAttemptedAt = now;
		});
	}

	private async updateChannels(
		ids: readonly string[],
		update: (channel: PaymentChannel) => void
	): Promise<void> {
		if (ids.length === 0) return;
		const manager = this.entityManager.fork();
		const channels = await manager.find(PaymentChannel, {
			id: { $in: [...ids] },
		});
		channels.forEach(update);
		await manager.flush();
	}
}
