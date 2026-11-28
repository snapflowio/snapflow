/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, QueryOrder } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { escrowDomain, hashVoucher } from '@snapflow/contracts';
import type { Hex } from 'viem';
import { pricedPlacement } from '../../../billing/queries/placement-price.query';
import { addMilliseconds, addSeconds } from '../../../common/utils/time.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import type { SettingsSnapshot } from '../../../settings/types/settings.types';
import {
	CHARGE_SETTLE_DELAY_MILLISECONDS,
	SETTLEMENT_WAKE_TOPIC,
} from '../../constants/payment-channel.constants';
import { EscrowAccount } from '../../entities/escrow-account.entity';
import { PaymentChannel } from '../../entities/payment-channel.entity';
import { PaymentChannelCharge } from '../../entities/payment-channel-charge.entity';
import { PaymentVoucher } from '../../entities/payment-voucher.entity';
import { PaymentChannelKind } from '../../enums/payment-channel-kind.enum';
import { VoucherSigningMode } from '../../enums/voucher-signing-mode.enum';
import { customerOutstanding } from '../../queries/customer-outstanding.query';
import { priceCharges } from '../../queries/price-charges.query';
import { receiptChainHead } from '../../queries/receipt-chain-head.query';
import type {
	PriceCharges,
	VoucherEvidence,
} from '../../types/payment-channel.types';
import {
	accountedCharge,
	boundCharge,
} from '../../utils/channels/channel-charge.util';
import { accountBlocked } from '../../utils/escrow/account-block.util';
import {
	chainSeconds,
	maxBigInt,
	microUsd,
} from '../../utils/escrow/escrow-amount.util';
import { chainTimestamp } from '../../utils/escrow/escrow-event-record.util';
import { receiptHeadsMetadata } from '../../utils/vouchers/receipt-chain.util';
import {
	channelBound,
	signableCumulative,
} from '../../utils/vouchers/voucher-limit.util';
import { voucherMessage } from '../../utils/vouchers/voucher-message.util';
import { DelegatedSignerService } from '../delegated-signer/delegated-signer.service';
import { ChainClockService } from '../escrow/chain-clock.service';
import { VoucherSignerScopeService } from './voucher-signer-scope.service';

export type VoucherSettings = Pick<SettingsSnapshot, 'voucherIntervalSeconds'>;

function totalCharged(charges: PriceCharges): bigint {
	return MicroUsd.sum([
		...charges.lines.map((line) => MicroUsd.parse(line.grossMicroUsd)),
		...charges.accruals.map((accrual) => accrual.grossMicroUsd),
	]).toBigInt();
}

interface ChannelBalance {
	available: bigint;
	outstanding: bigint;
}

@Injectable()
export class VoucherIssuanceService {
	constructor(
		private readonly delegatedSigners: DelegatedSignerService,
		private readonly signerScopes: VoucherSignerScopeService,
		private readonly wakes: ControlWakeService,
		private readonly chainClock: ChainClockService
	) {}

	async evaluate(
		manager: EntityManager,
		paymentChannelId: string,
		settings: VoucherSettings
	): Promise<void> {
		const channel = await manager.findOneOrFail(
			PaymentChannel,
			{ id: paymentChannelId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		const now = await databaseNow(manager);
		const chainNow = await this.chainClock.now();
		const chainReachedSeconds = await this.chainClock.reachedSeconds();
		const charges =
			channel.kind === PaymentChannelKind.SANDBOX
				? await this.meterCharges(manager, channel, now)
				: [];
		const charged = microUsd(channel.chargedMicroUsd);
		const previous = microUsd(channel.issuedMicroUsd);
		const claimed = microUsd(channel.claimedMicroUsd);
		const balance = await this.balance(manager, channel, chainNow);
		const scope = await this.signerScopes.forIssuance(
			manager,
			channel,
			chainNow,
			claimed
		);
		const signable = signableCumulative({
			charged,
			previous,
			balanceBound: channelBound(
				balance.available,
				balance.outstanding,
				claimed
			),
			signerBound: scope.bound,
		});
		const voucherError = scope.unusable ?? signable.limitedBy;
		const limitChanged = voucherError !== channel.voucherError;
		channel.voucherError = voucherError;
		if (scope.unusable === null && signable.cumulative > previous) {
			const heads = await this.receiptHeads(manager, charges);
			await this.issue(
				manager,
				channel,
				signable.cumulative,
				{ now, chainReachedSeconds },
				heads,
				{
					chargedMicroUsd: charged.toString(),
					availableMicroUsd: balance.available.toString(),
					outstandingMicroUsd: balance.outstanding.toString(),
					signerRemainingMicroUsd:
						scope.bound === null ? null : (scope.bound - claimed).toString(),
					limitedBy: signable.limitedBy,
					receiptHeads: heads,
				}
			);
		} else if (limitChanged) {
			this.notify(manager, channel);
		}
		const signed = microUsd(channel.signedMicroUsd);
		if (signed >= charged) channel.coveredAt = now;
		const idle =
			signed >= charged && charges.every(({ settledAt }) => settledAt !== null);
		channel.nextIssueAt = idle
			? null
			: addSeconds(now, settings.voucherIntervalSeconds);
	}

	private async meterCharges(
		manager: EntityManager,
		channel: PaymentChannel,
		now: Date
	): Promise<PaymentChannelCharge[]> {
		const charges = await manager.find(
			PaymentChannelCharge,
			{ paymentChannelId: channel.id },
			{ orderBy: { createdAt: QueryOrder.ASC, id: QueryOrder.ASC } }
		);
		for (const link of charges) {
			if (link.settledAt !== null) continue;
			const priced = await pricedPlacement(manager, link.placementPriceId);
			link.chargedMicroUsd = totalCharged(
				await priceCharges(manager, priced.placementPrice, priced.terms, now)
			).toString();
			if (
				link.endedAt !== null &&
				now >= addMilliseconds(link.endedAt, CHARGE_SETTLE_DELAY_MILLISECONDS)
			) {
				link.settledAt = now;
			}
		}
		channel.chargedMicroUsd = boundCharge(
			accountedCharge(channel, charges),
			channel
		).toString();
		return charges;
	}

	private async balance(
		manager: EntityManager,
		channel: PaymentChannel,
		chainNow: Date
	): Promise<ChannelBalance> {
		const account = await manager.findOne(EscrowAccount, {
			chainId: channel.chainId,
			contractAddress: channel.contractAddress,
			address: channel.customerAddress,
		});
		const available =
			account && !accountBlocked(account, chainNow)
				? microUsd(account.freeMicroUsd)
				: 0n;
		return {
			available,
			outstanding: await customerOutstanding(
				manager,
				channel,
				channel.customerAddress,
				channel.id
			),
		};
	}

	private async receiptHeads(
		manager: EntityManager,
		charges: readonly PaymentChannelCharge[]
	): Promise<Hex[]> {
		const heads: Hex[] = [];
		for (const link of charges) {
			if (link.settledAt !== null) continue;
			const { placementPrice } = await pricedPlacement(
				manager,
				link.placementPriceId
			);
			heads.push(
				(await receiptChainHead(manager, placementPrice.placementId)).digest
			);
		}
		return heads;
	}

	private async issue(
		manager: EntityManager,
		channel: PaymentChannel,
		cumulative: bigint,
		clocks: { now: Date; chainReachedSeconds: bigint },
		heads: readonly Hex[],
		evidence: VoucherEvidence
	): Promise<void> {
		const { now, chainReachedSeconds } = clocks;
		const latest = await manager.findOne(
			PaymentVoucher,
			{ paymentChannelId: channel.id },
			{
				orderBy: { sequence: QueryOrder.DESC },
				fields: ['sequence', 'timestamp'],
			}
		);
		const stored = {
			cumulativeMicroUsd: cumulative.toString(),
			timestamp: chainTimestamp(
				latest
					? maxBigInt(chainReachedSeconds, chainSeconds(latest.timestamp))
					: chainReachedSeconds
			),
			metadata: receiptHeadsMetadata(heads),
		};
		const message = voucherMessage(channel, stored);
		const digest = hashVoucher(
			escrowDomain(channel.chainId, channel.contractAddress),
			message
		);
		const voucher = manager.create(PaymentVoucher, {
			...stored,
			paymentChannelId: channel.id,
			sequence: (latest?.sequence ?? 0) + 1,
			digest,
			signerAddress: null,
			signature: null,
			signedAt: null,
			createdAt: now,
		});
		channel.issuedMicroUsd = stored.cumulativeMicroUsd;
		if (channel.signingMode === VoucherSigningMode.DELEGATED) {
			const signer = await this.delegatedSigners.forCustomer(
				manager,
				channel.customerAddress
			);
			if (!signer) throw new Error('A usable scope implies a delegated signer');
			await manager.flush();
			const signature = await this.delegatedSigners.signVoucher(
				manager,
				signer,
				{ voucherId: voucher.id, digest, message, evidence },
				now
			);
			manager.assign(voucher, {
				signerAddress: signer.signerAddress,
				signature,
				signedAt: now,
			});
			channel.signedMicroUsd = stored.cumulativeMicroUsd;
		}
		this.notify(manager, channel);
	}

	private notify(manager: EntityManager, channel: PaymentChannel): void {
		if (channel.machineId === null) return;
		this.wakes.notifyAfterCommit(manager, SETTLEMENT_WAKE_TOPIC, [
			channel.machineId,
		]);
	}
}
