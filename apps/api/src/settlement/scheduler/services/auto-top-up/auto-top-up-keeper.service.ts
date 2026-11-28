/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import type { Address } from 'viem';
import { FundingNoticeKind } from '../../../../billing/constants/funding.constants';
import { FundingNoticeEvent } from '../../../../billing/events/funding-notice.event';
import { addSeconds } from '../../../../common/utils/time.util';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { enqueueFundingNotice } from '../../../../notification/utils/notice-outbox.util';
import {
	AUTO_TOP_UP_DEFERRED_REVERTS,
	AUTO_TOP_UP_FAILURE,
} from '../../../constants/auto-top-up.constants';
import { AutoTopUp } from '../../../entities/auto-top-up.entity';
import { EscrowAccount } from '../../../entities/escrow-account.entity';
import { SettlementTransaction } from '../../../entities/settlement-transaction.entity';
import { SettlementTransactionKind } from '../../../enums/settlement-transaction-kind.enum';
import { SettlementTransactionStatus } from '../../../enums/settlement-transaction-status.enum';
import { autoTopUpState } from '../../../queries/auto-top-up-state.query';
import { ChainClockService } from '../../../services/escrow/chain-clock.service';
import { RelayFeeQuoteService } from '../../../services/relay/relay-fee-quote.service';
import {
	type AutoTopUpLimits,
	authorizesRelayer,
	autoTopUpDue,
} from '../../../utils/auto-top-up/auto-top-up.util';
import {
	contractRevertReason,
	isChainUnreachable,
} from '../../../utils/chain-error.util';
import { accountBlocked } from '../../../utils/escrow/account-block.util';
import { microUsd } from '../../../utils/escrow/escrow-amount.util';
import { configuredEscrow } from '../../../utils/escrow/escrow-identity.util';
import { EscrowWriterService } from '../escrow/escrow-writer.service';
import { OperatorTransactionService } from '../operator/operator-transaction.service';

const FAILED_TRANSACTION_STATUSES: ReadonlySet<string> = new Set([
	SettlementTransactionStatus.REVERTED,
	SettlementTransactionStatus.DROPPED,
]);

@Injectable()
export class AutoTopUpKeeperService {
	private readonly logger = new Logger(AutoTopUpKeeperService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly quotes: RelayFeeQuoteService,
		private readonly writer: EscrowWriterService,
		private readonly transactions: OperatorTransactionService,
		private readonly chainClock: ChainClockService
	) {}

	async topUpDue(): Promise<void> {
		const enabled = await this.entityManager
			.fork()
			.find(AutoTopUp, { enabled: true }, { fields: ['organizationId'] });
		for (const { organizationId } of enabled) {
			try {
				await this.topUp(organizationId);
			} catch (error) {
				if (isChainUnreachable(error)) throw error;
				this.logger.error(
					`Auto top-up of organization ${organizationId} failed`,
					error
				);
			}
		}
	}

	private async topUp(organizationId: string): Promise<void> {
		const manager = this.entityManager.fork();
		const relayer = this.config.get('settlement.relayerAddress');
		const escrow = configuredEscrow(this.config);
		const state = await autoTopUpState(
			manager,
			escrow,
			relayer,
			organizationId
		);
		const { settings, walletAddress, limits } = state;
		if (!settings?.enabled) return;
		const now = await databaseNow(manager);
		if (await this.lastTransactionFailed(manager, settings)) {
			return this.fail(
				manager,
				settings,
				now,
				AUTO_TOP_UP_FAILURE.TRANSACTION_FAILED
			);
		}
		if (!walletAddress || !authorizesRelayer(limits, relayer)) return;
		const account = await manager.findOne(EscrowAccount, {
			...escrow,
			address: walletAddress,
		});
		const chainNow = await this.chainClock.now();
		if (accountBlocked(account, chainNow)) return;
		if (!this.due(settings, limits, account, { now, chainNow })) return;
		const failure = await this.send(settings, walletAddress, limits, now);
		if (failure !== null && !AUTO_TOP_UP_DEFERRED_REVERTS.has(failure)) {
			return this.fail(manager, settings, now, failure);
		}
	}

	private due(
		settings: AutoTopUp,
		limits: AutoTopUpLimits,
		account: EscrowAccount | null,
		clocks: { now: Date; chainNow: Date }
	): boolean {
		if (!autoTopUpDue(limits, account, clocks.chainNow)) return false;
		return (
			settings.lastAttemptAt === null ||
			clocks.now >=
				addSeconds(settings.lastAttemptAt, limits.minIntervalSeconds)
		);
	}

	private async send(
		settings: AutoTopUp,
		walletAddress: Address,
		limits: AutoTopUpLimits,
		now: Date
	): Promise<string | null> {
		try {
			return await this.sendPriced(settings, walletAddress, limits, now);
		} catch (error) {
			if (isChainUnreachable(error)) throw error;
			return contractRevertReason(error);
		}
	}

	private async sendPriced(
		settings: AutoTopUp,
		walletAddress: Address,
		limits: AutoTopUpLimits,
		now: Date
	): Promise<string | null> {
		const maximumFee = microUsd(limits.maxRelayFeeMicroUsd);
		const priced = await this.writer.autoTopUp(walletAddress, maximumFee);
		const relayFee = this.quotes.cost(
			priced.gas,
			await this.quotes.transactionPricing({
				account: this.config.get('settlement.relayerAddress'),
				...priced,
			})
		);
		if (relayFee > maximumFee) return AUTO_TOP_UP_FAILURE.RELAY_FEE_ABOVE_CAP;
		await this.transactions.send(
			SettlementTransactionKind.AUTO_TOP_UP,
			await this.writer.autoTopUp(walletAddress, relayFee),
			{},
			async (manager, hash) => {
				const current = await manager.findOneOrFail(AutoTopUp, {
					organizationId: settings.organizationId,
				});
				manager.assign(current, {
					lastAttemptAt: now,
					lastTransactionHash: hash,
					lastFailedAt: null,
					lastError: null,
				});
			}
		);
		return null;
	}

	private async lastTransactionFailed(
		manager: EntityManager,
		settings: AutoTopUp
	): Promise<boolean> {
		if (settings.lastTransactionHash === null || settings.lastFailedAt) {
			return false;
		}
		const transaction = await manager.findOne(
			SettlementTransaction,
			{ transactionHash: settings.lastTransactionHash },
			{ fields: ['status'] }
		);
		return (
			transaction !== null &&
			FAILED_TRANSACTION_STATUSES.has(transaction.status)
		);
	}

	private async fail(
		manager: EntityManager,
		settings: AutoTopUp,
		now: Date,
		reason: string
	): Promise<void> {
		const firstFailure = settings.lastFailedAt === null;
		manager.assign(settings, {
			lastAttemptAt: now,
			lastFailedAt: now,
			lastError: reason,
		});
		await manager.flush();
		this.logger.warn(
			`Auto top-up of organization ${settings.organizationId} failed: ${reason}`
		);
		if (!firstFailure) return;
		await enqueueFundingNotice(
			manager,
			new FundingNoticeEvent(
				settings.organizationId,
				`auto-top-up:${settings.organizationId}:${now.getTime()}`,
				{
					kind: FundingNoticeKind.AUTO_TOP_UP_FAILED,
					amountMicroUsd: settings.amountMicroUsd,
					reason,
				},
				now
			)
		);
	}
}
