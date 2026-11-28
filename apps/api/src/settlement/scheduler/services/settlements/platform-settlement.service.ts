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
import { MAX_BATCH_SIZE } from '@snapflow/contracts';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { PLATFORM_SETTLEMENT } from '../../../constants/host-settlement.constants';
import { EscrowAccount } from '../../../entities/escrow-account.entity';
import { PaymentChannel } from '../../../entities/payment-channel.entity';
import { PaymentChannelKind } from '../../../enums/payment-channel-kind.enum';
import { SettlementTransactionKind } from '../../../enums/settlement-transaction-kind.enum';
import {
	latestVouchers,
	VoucherSelection,
} from '../../../queries/latest-vouchers.query';
import { settlementClaims } from '../../../queries/settlement-claims.query';
import type { HostSettlementItem } from '../../../types/host-settlement.types';
import type {
	OperatorCall,
	OperatorTransactionSubject,
} from '../../../types/operator-transaction.types';
import {
	contractRevertReason,
	isChainUnreachable,
} from '../../../utils/chain-error.util';
import { microUsd } from '../../../utils/escrow/escrow-amount.util';
import { configuredEscrow } from '../../../utils/escrow/escrow-identity.util';
import { settlementItem } from '../../../utils/settlements/host-settlement-call.util';
import { EscrowWriterService } from '../escrow/escrow-writer.service';
import { OperatorTransactionService } from '../operator/operator-transaction.service';

@Injectable()
export class PlatformSettlementService {
	private readonly logger = new Logger(PlatformSettlementService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly locks: RedisLockProvider,
		private readonly writer: EscrowWriterService,
		private readonly transactions: OperatorTransactionService
	) {}

	async settleDue(): Promise<void> {
		const due = await this.locks.claim(
			PLATFORM_SETTLEMENT.CLAIM_KEY,
			PLATFORM_SETTLEMENT.INTERVAL_SECONDS
		);
		if (!due) return;
		try {
			await this.settle();
		} catch (error) {
			await this.locks.releaseClaim(PLATFORM_SETTLEMENT.CLAIM_KEY);
			throw error;
		}
	}

	private async settle(): Promise<void> {
		const manager = this.entityManager.fork();
		const receiver = this.config.get('settlement.feeReceiverAddress');
		const account = await manager.findOne(EscrowAccount, {
			...configuredEscrow(this.config),
			address: receiver,
		});
		if (account && microUsd(account.feesAccruedMicroUsd) > 0n) {
			await this.send(SettlementTransactionKind.SWEEP_FEES, () =>
				this.writer.sweepFees(receiver)
			);
		}
		if (
			account &&
			microUsd(account.hostBalanceMicroUsd) > 0n &&
			this.payoutAddressSet(account)
		) {
			await this.send(
				SettlementTransactionKind.WITHDRAW_HOST,
				() => this.writer.withdrawHost(receiver),
				{ hostAddress: receiver }
			);
		}
		const claims = await this.claims(manager);
		for (let start = 0; start < claims.length; start += MAX_BATCH_SIZE) {
			const batch = claims.slice(start, start + MAX_BATCH_SIZE);
			const items = await settlementClaims(manager, batch);
			await this.send(
				SettlementTransactionKind.CLAIM_BATCH,
				async () => {
					const { call, paid } = await this.writer.claimBatch(items);
					return paid > 0n ? call : null;
				},
				{ claims: batch }
			);
		}
	}

	private async claims(manager: EntityManager): Promise<HostSettlementItem[]> {
		const claiming = await this.transactions.claimingChannels(manager);
		const channels = (
			await manager.find(PaymentChannel, {
				...configuredEscrow(this.config),
				kind: PaymentChannelKind.PLATFORM,
			})
		).filter(
			(channel) =>
				!claiming.has(channel.id) &&
				microUsd(channel.signedMicroUsd) > microUsd(channel.claimedMicroUsd)
		);
		const signed = await latestVouchers(
			manager,
			channels.map(({ id }) => id),
			VoucherSelection.SIGNED
		);
		return channels.flatMap((channel) => {
			const voucher = signed.get(channel.id);
			return voucher ? [settlementItem(channel, voucher)] : [];
		});
	}

	private payoutAddressSet(account: EscrowAccount): boolean {
		if (account.payoutAddress !== null) return true;
		this.logger.error(
			`The fee receiver ${account.address} set no payout address, so its platform channel earnings cannot be withdrawn; the fee receiver Safe must call setPayoutAddress(${account.address}) on the escrow once`
		);
		return false;
	}

	private async send(
		kind: SettlementTransactionKind,
		simulate: () => Promise<OperatorCall | null>,
		subject: OperatorTransactionSubject = {}
	): Promise<void> {
		let call: OperatorCall | null;
		try {
			call = await simulate();
		} catch (error) {
			if (isChainUnreachable(error)) throw error;
			this.logger.warn(
				`Platform settlement ${kind} failed: ${contractRevertReason(error)}`
			);
			return;
		}
		if (call === null) return;
		await this.transactions.send(kind, call, subject);
	}
}
