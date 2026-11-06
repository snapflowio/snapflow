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
import { pricedLease } from '../../billing/queries/lease-price.query';
import { addSeconds, millisecondsBetween } from '../../common/utils/time.util';
import { BasisPoints } from '../../common/values/basis-points.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import type { SettingsSnapshot } from '../../settings/types/settings.types';
import { CHANNEL_SETTLE_DELAY_MILLISECONDS } from '../constants/payment-channel.constants';
import { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentVoucher } from '../entities/payment-voucher.entity';
import { PaymentChannelState } from '../enums/payment-channel-state.enum';
import { VoucherSigningMode } from '../enums/voucher-signing-mode.enum';
import { leaseCharges } from '../queries/lease-charges.query';
import { platformServiceCharges } from '../queries/platform-service-charges.query';
import type { VoucherAmounts } from '../types/payment-channel.types';
import {
	channelLease,
	channelServicePeriod,
} from '../utils/payment-channel-kind.util';
import {
	amountColumns,
	amountsExceed,
	cumulativeAmounts,
	owedAmounts,
	serviceAmounts,
	storedAmounts,
	voucherTotal,
	ZERO_VOUCHER_AMOUNTS,
} from '../utils/voucher-amounts.util';
import {
	voucherExpiry,
	voucherReissueDue,
} from '../utils/voucher-schedule.util';
import { VoucherSigningService } from './voucher-signing.service';

export type VoucherSettings = Pick<
	SettingsSnapshot,
	'voucherIntervalSeconds' | 'voucherLifetimeHours'
>;

// The latest voucher stays current while it carries every amount, is not
// due for a reissue that would extend its expiry, and, when unsigned, does
// not outlive the key that is to sign it.
function stillCurrent(
	latest: PaymentVoucher,
	amounts: VoucherAmounts,
	expiresAt: Date,
	now: Date,
	settings: VoucherSettings
): boolean {
	const reissue =
		voucherReissueDue(latest.expiresAt, now, settings.voucherLifetimeHours) &&
		expiresAt > latest.expiresAt;
	return (
		!amountsExceed(amounts, storedAmounts(latest)) &&
		!reissue &&
		(latest.signature !== null || latest.expiresAt <= expiresAt)
	);
}

// Brings one channel's vouchers up to what it owes: a new voucher
// when an amount grew or the latest one nears expiry, signed at once in
// delegated mode and left for the customer in client mode.
@Injectable()
export class VoucherIssuanceService {
	constructor(private readonly signing: VoucherSigningService) {}

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
		if (channel.state === PaymentChannelState.CLOSED) return;
		const now = await databaseNow(manager);
		channel.nextIssueAt = addSeconds(now, settings.voucherIntervalSeconds);
		const latest = await manager.findOne(
			PaymentVoucher,
			{ paymentChannelId: channel.id },
			{ orderBy: { sequence: QueryOrder.DESC } }
		);
		const amounts = cumulativeAmounts(
			await this.owed(manager, channel, now),
			latest ? storedAmounts(latest) : ZERO_VOUCHER_AMOUNTS
		);
		if (voucherTotal(amounts).isZero()) {
			channel.coveredAt = now;
		} else {
			const voucher = await this.currentVoucher(
				manager,
				channel,
				latest,
				amounts,
				now,
				settings
			);
			if (voucher.signature !== null) channel.coveredAt = now;
		}
		this.endServicePeriod(channel, now);
		if (this.settled(channel, now)) {
			channel.state = PaymentChannelState.CLOSED;
		}
	}

	// A lease channel owes its lease's charges; a platform service channel
	// owes the platform fees of its month, all of them service.
	private async owed(
		manager: EntityManager,
		channel: PaymentChannel,
		now: Date
	): Promise<VoucherAmounts> {
		const period = channelServicePeriod(channel);
		if (period !== null) {
			return serviceAmounts(
				await platformServiceCharges(
					manager,
					channel.customerOrganizationId,
					period
				)
			);
		}
		const leased = channelLease(channel);
		if (leased === null) {
			throw new Error(`Payment channel ${channel.channelId} pays for nothing`);
		}
		const { lease, terms } = await pricedLease(manager, leased.leaseId);
		return owedAmounts(
			await leaseCharges(manager, lease, terms, now),
			BasisPoints.of(lease.markupBasisPoints, 'Markup')
		);
	}

	// A platform service channel stops accruing when its month ends and
	// closes like a lease channel once that month's last fees are in. One
	// opened after its month, when the customer linked a funding wallet late,
	// counts as closed when it opened, so its customer still has a voucher
	// lifetime to sign the voucher.
	private endServicePeriod(channel: PaymentChannel, now: Date): void {
		const period = channelServicePeriod(channel);
		if (
			period === null ||
			channel.state !== PaymentChannelState.OPEN ||
			now < period.end
		) {
			return;
		}
		channel.state = PaymentChannelState.CLOSING;
		channel.closedAt =
			channel.openedAt > period.end ? channel.openedAt : period.end;
	}

	// The voucher that carries amounts: the latest one while it still does
	// and stays claimable long enough, otherwise the next sequence.
	private async currentVoucher(
		manager: EntityManager,
		channel: PaymentChannel,
		latest: PaymentVoucher | null,
		amounts: VoucherAmounts,
		now: Date,
		settings: VoucherSettings
	): Promise<PaymentVoucher> {
		const delegated = channel.signingMode === VoucherSigningMode.DELEGATED;
		const key = delegated
			? await this.signing.delegatedKey(manager, channel, now)
			: null;
		const expiresAt = voucherExpiry(
			now,
			settings.voucherLifetimeHours,
			key?.expiresAt ?? null
		);
		const voucher =
			latest !== null && stillCurrent(latest, amounts, expiresAt, now, settings)
				? latest
				: manager.create(PaymentVoucher, {
						paymentChannelId: channel.id,
						sequence: (latest?.sequence ?? 0) + 1,
						...amountColumns(amounts),
						issuedAt: now,
						expiresAt,
						signerAddress: null,
						signature: null,
						signedAt: null,
						claimableUntil: null,
					});
		if (voucher.signature === null && delegated) {
			await this.signing.signDelegated(manager, channel, voucher, key, now);
		}
		return voucher;
	}

	// A closing channel gets its final voucher once the lease's last usage
	// had time to be billed.
	private settled(channel: PaymentChannel, now: Date): boolean {
		return (
			channel.state === PaymentChannelState.CLOSING &&
			channel.closedAt !== null &&
			millisecondsBetween(channel.closedAt, now) >=
				CHANNEL_SETTLE_DELAY_MILLISECONDS
		);
	}
}
