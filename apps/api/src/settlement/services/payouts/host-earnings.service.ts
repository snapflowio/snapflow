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
import type { Address } from 'viem';
import { errorMessage } from '../../../common/utils/error/error.util';
import { addSeconds } from '../../../common/utils/time.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { SettingsService } from '../../../settings/services/settings.service';
import {
	DEADLINE_CLAIMS,
	HOST_PAYOUT_CHECK_SECONDS,
} from '../../constants/host-settlement.constants';
import type {
	HostEscrowBalanceDto,
	HostMachineEarningsDto,
} from '../../dto/host-earnings.dto';
import { EscrowAccount } from '../../entities/escrow-account.entity';
import { PaymentChannel } from '../../entities/payment-channel.entity';
import { PaymentWallet } from '../../entities/payment-wallet.entity';
import { PaymentWalletPurpose } from '../../enums/payment-wallet-purpose.enum';
import { organizationHostKeys } from '../../queries/host-keys.query';
import {
	type HostPayoutSchedule,
	hostPayoutSchedules,
} from '../../queries/host-payout-schedule.query';
import { activeBlockedAt } from '../../utils/escrow/account-block.util';
import { maxBigInt, microUsd } from '../../utils/escrow/escrow-amount.util';
import { configuredEscrow } from '../../utils/escrow/escrow-identity.util';
import {
	hostShare,
	netPayout,
	payoutDue,
	payoutThreshold,
} from '../../utils/payouts/payout-due.util';
import {
	type SettlementFeeQuote,
	settlementRelayFee,
} from '../../utils/relay/gas-cost.util';
import { ChainClockService } from '../escrow/chain-clock.service';
import { RelayFeeQuoteService } from '../relay/relay-fee-quote.service';

const ZERO = '0';

const NO_SCHEDULE: HostPayoutSchedule = {
	claimDeadlineAt: null,
	owedChannels: 0,
	draining: false,
	signerCapped: false,
};

type EarningsField =
	| 'unclaimedMicroUsd'
	| 'creditedMicroUsd'
	| 'withdrawnMicroUsd'
	| 'frozenMicroUsd'
	| 'pendingMicroUsd';

type PayoutForecast = Pick<
	HostMachineEarningsDto,
	| 'relayFeeMicroUsd'
	| 'netPayoutMicroUsd'
	| 'payoutThresholdMicroUsd'
	| 'payoutDue'
>;

@Injectable()
export class HostEarningsService {
	private readonly logger = new Logger(HostEarningsService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService,
		private readonly settings: SettingsService,
		private readonly chainClock: ChainClockService,
		private readonly quotes: RelayFeeQuoteService
	) {}

	async forOrganization(organizationId: string): Promise<HostEscrowBalanceDto> {
		const manager = this.entityManager.fork();
		const escrow = configuredEscrow(this.config);
		const [keys, wallet] = await Promise.all([
			organizationHostKeys(manager, organizationId),
			manager.findOne(PaymentWallet, {
				organizationId,
				purpose: PaymentWalletPurpose.PAYOUT,
			}),
		]);
		const addresses = keys.map(({ address }) => address);
		const [accounts, channels] =
			addresses.length === 0
				? [[], []]
				: await Promise.all([
						manager.find(EscrowAccount, {
							...escrow,
							address: { $in: addresses },
						}),
						manager.find(PaymentChannel, {
							...escrow,
							hostAddress: { $in: addresses },
						}),
					]);
		const byAddress = new Map(
			accounts.map((account) => [account.address, account])
		);
		const [settings, now, schedules, quote] = await Promise.all([
			this.settings.get(),
			this.chainClock.now(),
			hostPayoutSchedules(manager, escrow, { keys, channels }),
			this.quote(),
		]);
		const payoutMinimum = MicroUsd.fromCents(
			settings.hostPayoutMinimumCents
		).toBigInt();
		const unclaimed = new Map<Address, bigint>();
		for (const channel of channels) {
			const owed = maxBigInt(
				0n,
				microUsd(channel.signedMicroUsd) - microUsd(channel.claimedMicroUsd)
			);
			unclaimed.set(
				channel.hostAddress,
				(unclaimed.get(channel.hostAddress) ?? 0n) +
					hostShare(owed, channel.feeBps)
			);
		}
		const machines = keys.map((key): HostMachineEarningsDto => {
			const account = byAddress.get(key.address);
			const schedule = schedules.get(key.address) ?? NO_SCHEDULE;
			const owed = unclaimed.get(key.address) ?? 0n;
			const credited = microUsd(account?.hostBalanceMicroUsd ?? ZERO);
			const pending = owed + credited;
			const payout = forecast(quote, schedule, pending, payoutMinimum);
			return {
				machineId: key.machineId,
				machineName: key.machineName,
				hostAddress: key.address,
				current: key.retiredAt === null,
				payoutAddress: account?.payoutAddress ?? null,
				unclaimedMicroUsd: owed.toString(),
				creditedMicroUsd: credited.toString(),
				withdrawnMicroUsd: account?.hostWithdrawnMicroUsd ?? ZERO,
				frozenMicroUsd: account?.frozenMicroUsd ?? ZERO,
				blockedAt: activeBlockedAt(account, now),
				pendingMicroUsd: pending.toString(),
				...payout,
				nextPayoutAt: payout.payoutDue
					? addSeconds(now, HOST_PAYOUT_CHECK_SECONDS)
					: null,
				claimDeadlineAt: schedule.claimDeadlineAt,
			};
		});
		return {
			payoutWalletAddress: wallet?.address ?? null,
			unclaimedMicroUsd: total(machines, 'unclaimedMicroUsd'),
			creditedMicroUsd: total(machines, 'creditedMicroUsd'),
			withdrawnMicroUsd: total(machines, 'withdrawnMicroUsd'),
			frozenMicroUsd: total(machines, 'frozenMicroUsd'),
			pendingMicroUsd: total(machines, 'pendingMicroUsd'),
			payoutMinimumMicroUsd: payoutMinimum.toString(),
			relayFeeMicroUsd: quote ? settlementRelayFee(quote, 0).toString() : null,
			claimDeadlineNoticeSeconds: DEADLINE_CLAIMS.NOTICE_SECONDS,
			nextPayoutAt: soonest(machines.map(({ nextPayoutAt }) => nextPayoutAt)),
			machines,
		};
	}

	private async quote(): Promise<SettlementFeeQuote | null> {
		try {
			return await this.quotes.hostSettlementQuote();
		} catch (error) {
			this.logger.warn(
				`Serving host earnings without a relay fee forecast: ${errorMessage(error)}`
			);
			return null;
		}
	}
}

function forecast(
	quote: SettlementFeeQuote | null,
	schedule: HostPayoutSchedule,
	pendingMicroUsd: bigint,
	minimumMicroUsd: bigint
): PayoutForecast {
	if (!quote) {
		return {
			relayFeeMicroUsd: null,
			netPayoutMicroUsd: null,
			payoutThresholdMicroUsd: null,
			payoutDue: false,
		};
	}
	const candidate = {
		withdrawableMicroUsd: pendingMicroUsd,
		relayFeeMicroUsd: settlementRelayFee(
			quote,
			Math.min(schedule.owedChannels, MAX_BATCH_SIZE)
		),
		minimumMicroUsd,
		draining: schedule.draining,
		signerCapped: schedule.signerCapped,
	};
	return {
		relayFeeMicroUsd: candidate.relayFeeMicroUsd.toString(),
		netPayoutMicroUsd: netPayout(candidate).toString(),
		payoutThresholdMicroUsd: payoutThreshold(candidate).toString(),
		payoutDue: payoutDue(candidate),
	};
}

function total(
	machines: readonly HostMachineEarningsDto[],
	field: EarningsField
): string {
	return machines
		.reduce((sum, machine) => sum + microUsd(machine[field]), 0n)
		.toString();
}

function soonest(dates: readonly (Date | null)[]): Date | null {
	return dates.reduce<Date | null>(
		(earliest, date) =>
			date !== null && (earliest === null || date < earliest) ? date : earliest,
		null
	);
}
