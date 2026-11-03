/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { ledgerBalance } from '../../../billing/ledger/queries/ledger-balance.query';
import { BillingLedgerService } from '../../../billing/ledger/services/billing-ledger.service';
import {
	hostPendingEarningsAccount,
	hostTransfersPendingAccount,
	providerEarningsAccount,
} from '../../../billing/ledger/utils/ledger/billing-ledger-accounts.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { addDays } from '../../../common/utils/time.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import type { SettingsSnapshot } from '../../../settings/platform/types/settings.types';
import { EARNINGS_MATURITY_BATCH_SIZE } from '../constants/payments.constants';
import type {
	HostEarningsDto,
	HostEarningsMaturityDto,
} from '../dto/host-earnings.dto';
import { PaymentMethod } from '../entities/payment-method.entity';
import {
	lockReleasableLine,
	type MaturityCandidate,
	type MaturityCursor,
	markEarningsReleased,
	maturityCandidates,
	unreleasedEarnings,
} from '../queries/host-earnings.query';
import {
	earningsMaturesAt,
	newFundingUntil,
	payoutHoldDays,
} from '../utils/earnings-maturity.util';
import { nextPayoutDate, startOfUtcDay } from '../utils/payout.util';
import { earningsMaturityPosting } from '../utils/postings/earnings-posting.util';

interface MaturityContext {
	settings: SettingsSnapshot;
	machines: ReadonlyMap<string, Pick<Machine, 'tier' | 'restrictedAt'>>;
	newFunding: ReadonlyMap<string, Date | null>;
}

interface MaturityLine {
	machineId: string;
	customerOrganizationId: string;
	reconciledAt: Date;
}

const ISO_DATE_LENGTH = 10;

@Injectable()
export class EarningsMaturityService {
	private readonly logger = new Logger(EarningsMaturityService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly ledger: BillingLedgerService,
		private readonly settings: SettingsService
	) {}

	async releaseMatured(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const settings = await this.settings.get();
			const now = await databaseNow(this.entityManager);
			const shortestHold = Math.min(
				settings.payoutHoldCommunityDays,
				settings.payoutHoldVerifiedDays,
				settings.payoutHoldDatacenterDays
			);
			const reconciledBefore = addDays(now, -shortestHold);
			let after: MaturityCursor | null = null;
			for (;;) {
				const candidates: MaturityCandidate[] = await maturityCandidates(
					this.entityManager,
					reconciledBefore,
					after,
					EARNINGS_MATURITY_BATCH_SIZE
				);
				if (candidates.length === 0) return;
				const context = await this.context(settings, candidates);
				for (const candidate of candidates) {
					const maturesAt = this.maturesAt(context, candidate);
					if (maturesAt && maturesAt <= now) {
						await this.releaseSafely(candidate, maturesAt);
					}
				}
				const last = candidates[candidates.length - 1];
				after = { reconciledAt: last.reconciledAt, lineId: last.lineId };
			}
		});
	}

	async hostEarnings(organizationId: string): Promise<HostEarningsDto> {
		const manager = this.entityManager.fork();
		const settings = await this.settings.get();
		const now = await databaseNow(manager);
		const unreleased = await unreleasedEarnings(manager, organizationId);
		const context = await this.context(settings, unreleased);
		const maturing = new Map<string, MicroUsd>();
		for (const earnings of unreleased) {
			const maturesAt = this.maturesAt(context, earnings);
			if (!maturesAt) continue;
			const day = startOfUtcDay(maturesAt < now ? now : maturesAt)
				.toISOString()
				.slice(0, ISO_DATE_LENGTH);
			maturing.set(
				day,
				(maturing.get(day) ?? MicroUsd.ZERO).add(earnings.pendingMicroUsd)
			);
		}
		return {
			pendingMicroUsd: (
				await ledgerBalance(manager, hostPendingEarningsAccount(organizationId))
			).toString(),
			availableMicroUsd: (
				await ledgerBalance(manager, providerEarningsAccount(organizationId))
			).toString(),
			inTransferMicroUsd: (
				await ledgerBalance(
					manager,
					hostTransfersPendingAccount(organizationId)
				)
			).toString(),
			nextPayoutDate: nextPayoutDate(now, settings.payoutWeekday),
			payoutMinimumCents: settings.payoutMinimumCents,
			maturing: [...maturing.entries()]
				.sort(([left], [right]) => left.localeCompare(right))
				.map(
					([maturesOn, amount]): HostEarningsMaturityDto => ({
						maturesOn,
						amountMicroUsd: amount.toString(),
					})
				),
		};
	}

	private maturesAt(context: MaturityContext, line: MaturityLine): Date | null {
		const machine = context.machines.get(line.machineId);
		if (!machine || machine.restrictedAt) return null;
		return earningsMaturesAt({
			reconciledAt: line.reconciledAt,
			holdDays: payoutHoldDays(machine.tier, context.settings),
			newFundingUntil:
				context.newFunding.get(line.customerOrganizationId) ?? null,
		});
	}

	private async context(
		settings: SettingsSnapshot,
		lines: readonly MaturityLine[]
	): Promise<MaturityContext> {
		const manager = this.entityManager.fork();
		const machineIds = [...new Set(lines.map((line) => line.machineId))];
		const customerIds = [
			...new Set(lines.map((line) => line.customerOrganizationId)),
		];
		const machines = await manager.find(
			Machine,
			{ id: { $in: machineIds } },
			{ fields: ['id', 'tier', 'restrictedAt'] }
		);
		const methods = await manager.find(
			PaymentMethod,
			{ organizationId: { $in: customerIds }, firstChargedAt: { $ne: null } },
			{ fields: ['organizationId', 'firstChargedAt'] }
		);
		return {
			settings,
			machines: new Map(machines.map((machine) => [machine.id, machine])),
			newFunding: new Map(
				customerIds.map((customerId) => [
					customerId,
					newFundingUntil(
						methods
							.filter((method) => method.organizationId === customerId)
							.flatMap((method) =>
								method.firstChargedAt ? [method.firstChargedAt] : []
							),
						settings.newFundingHoldDays
					),
				])
			),
		};
	}

	private async releaseSafely(
		candidate: MaturityCandidate,
		maturesAt: Date
	): Promise<void> {
		try {
			await this.entityManager.fork().transactional(async (manager) => {
				const pending = await lockReleasableLine(manager, candidate.lineId);
				if (pending === null || !pending.isPositive()) return;
				await this.ledger.post(
					manager,
					earningsMaturityPosting({
						lineId: candidate.lineId,
						hostOrganizationId: candidate.hostOrganizationId,
						amountMicroUsd: pending,
						effectiveAt: maturesAt,
					})
				);
				await markEarningsReleased(manager, candidate.lineId);
			});
		} catch (error) {
			this.logger.error(
				`Earnings of billing line ${candidate.lineId} stay pending: ${errorMessage(error)}`
			);
		}
	}
}
