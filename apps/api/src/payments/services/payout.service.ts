/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { LockMode, RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { ledgerBalance } from '../../billing/queries/ledger-balance.query';
import { BillingLedgerService } from '../../billing/services/billing-ledger.service';
import { providerEarningsAccount } from '../../billing/utils/ledger/billing-ledger-accounts.util';
import {
	isStripeObjectMissing,
	stripeErrorDetails,
} from '../../common/utils/error/stripe-error.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import {
	PAYOUT_BATCH_SIZE,
	PAYOUT_TRANSFER_PAGE_SIZE,
	PaymentsErrorCode,
	PayoutsBlockedReason,
} from '../constants/payments.constants';
import {
	STRIPE_CLIENT,
	STRIPE_CURRENCY,
	STRIPE_IDEMPOTENCY_SAFE_MILLISECONDS,
	STRIPE_TRANSFER_GROUP_PREFIX,
	StripeErrorCode,
	StripeIdempotencyPrefix,
	StripeMetadataKey,
	StripeRequestParam,
} from '../constants/stripe.constants';
import {
	type ListPayoutsQueryDto,
	PayoutDto,
	type PayoutPageDto,
} from '../dto/payout.dto';
import { PaymentAccount } from '../entities/payment-account.entity';
import { Payout } from '../entities/payout.entity';
import { PayoutBatch } from '../entities/payout-batch.entity';
import { PayoutState } from '../enums/payout-state.enum';
import {
	type PayoutCandidate,
	payoutCandidates,
} from '../queries/payout-eligibility.query';
import { isoWeekday, isoWeekId, payoutAmount } from '../utils/payout.util';
import {
	payoutCommitPosting,
	payoutFailurePosting,
	payoutTransferPosting,
} from '../utils/postings/payout-posting.util';
import { idempotencyKey, stripeTimestamp } from '../utils/stripe-amount.util';
import { PaymentAccountService } from './payment-account.service';

function transferGroup(payout: Payout): string {
	return `${STRIPE_TRANSFER_GROUP_PREFIX}${payout.batchId}`;
}

@Injectable()
export class PayoutService {
	private readonly logger = new Logger(PayoutService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly ledger: BillingLedgerService,
		private readonly settings: SettingsService,
		private readonly accounts: PaymentAccountService
	) {}

	async runPayouts(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			await this.retryPending();
			const settings = await this.settings.get();
			const batch = await this.dueBatch(settings.payoutWeekday);
			if (!batch) return;
			await this.runBatch(batch.id, settings.payoutMinimumCents);
			await this.entityManager
				.fork()
				.nativeUpdate(
					PayoutBatch,
					{ id: batch.id },
					{ completedAt: await databaseNow(this.entityManager) }
				);
		});
	}

	async list(
		query: ListPayoutsQueryDto,
		organizationId?: string
	): Promise<PayoutPageDto> {
		const page = await findCursorPage(this.entityManager.fork(), Payout, {
			where: {
				...(organizationId ? { organizationId } : {}),
				...(query.state ? { state: query.state } : {}),
			},
			orderBy: { createdAt: 'DESC', id: 'DESC' },
			limit: query.limit,
			cursor: query.cursor,
		});
		return {
			items: page.items.map((payout) => PayoutDto.from(payout)),
			nextCursor: page.nextCursor,
		};
	}

	async retry(payoutId: string): Promise<Payout> {
		const payout = await this.entityManager
			.fork()
			.findOne(Payout, { id: payoutId });
		if (!payout) throw new NotFoundException(`Payout ${payoutId} not found`);
		if (payout.state !== PayoutState.PENDING) {
			throw new ConflictException({
				code: PaymentsErrorCode.PAYOUT_NOT_PENDING,
				message: 'Only a pending payout can be retried',
			});
		}
		await this.transfer(payout);
		return this.entityManager.fork().findOneOrFail(Payout, { id: payoutId });
	}

	async confirmTransfer(transfer: Stripe.Transfer): Promise<void> {
		const payoutId = transfer.metadata[StripeMetadataKey.PAYOUT_ID];
		if (!payoutId) return;
		await this.complete(payoutId, transfer);
	}

	// The weekly batch runs on or after the payout weekday, once per ISO week,
	// so a missed payout day is caught up and an interrupted batch resumes.
	private dueBatch(payoutWeekday: number): Promise<PayoutBatch | null> {
		return this.entityManager.fork().transactional(async (manager) => {
			const now = await databaseNow(manager);
			if (isoWeekday(now) < payoutWeekday) return null;
			const isoWeek = isoWeekId(now);
			const existing = await manager.findOne(PayoutBatch, { isoWeek });
			if (existing) return existing.completedAt ? null : existing;
			const batch = Object.assign(new PayoutBatch(), {
				id: randomUUID(),
				isoWeek,
				startedAt: now,
			});
			manager.persist(batch);
			return batch;
		});
	}

	private async retryPending(): Promise<void> {
		const pending = await this.entityManager.find(
			Payout,
			{ state: PayoutState.PENDING },
			{ orderBy: { createdAt: 'ASC', id: 'ASC' }, limit: PAYOUT_BATCH_SIZE }
		);
		for (const payout of pending) await this.transferSafely(payout);
	}

	private async runBatch(
		batchId: string,
		payoutMinimumCents: number
	): Promise<void> {
		let after: string | null = null;
		for (;;) {
			const candidates: PayoutCandidate[] = await payoutCandidates(
				this.entityManager,
				after,
				PAYOUT_BATCH_SIZE
			);
			if (candidates.length === 0) return;
			for (const candidate of candidates) {
				await this.payCandidate(
					candidate.organizationId,
					batchId,
					payoutMinimumCents
				);
			}
			after = candidates[candidates.length - 1].organizationId;
		}
	}

	private async payCandidate(
		organizationId: string,
		batchId: string,
		payoutMinimumCents: number
	): Promise<void> {
		try {
			const payout = await this.commit(
				organizationId,
				batchId,
				payoutMinimumCents
			);
			if (payout) await this.transfer(payout);
		} catch (error) {
			this.logger.error(
				`Payout of ${organizationId} in batch ${batchId} failed: ${stripeErrorDetails(error)}`
			);
		}
	}

	private commit(
		organizationId: string,
		batchId: string,
		payoutMinimumCents: number
	): Promise<Payout | null> {
		return this.entityManager.fork().transactional(async (manager) => {
			await manager.findOneOrFail(
				PaymentAccount,
				{ organizationId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			const available = await ledgerBalance(
				manager,
				providerEarningsAccount(organizationId)
			);
			const amount = payoutAmount(available, payoutMinimumCents);
			if (!amount) return null;
			const createdAt = await databaseNow(manager);
			const payout = Object.assign(new Payout(), {
				id: randomUUID(),
				organizationId,
				batchId,
				amountCents: amount.amountCents,
				amountMicroUsd: amount.amountMicroUsd.toString(),
				createdAt,
			});
			manager.persist(payout);
			await this.ledger.post(
				manager,
				payoutCommitPosting({
					payoutId: payout.id,
					organizationId,
					amountMicroUsd: amount.amountMicroUsd,
					effectiveAt: createdAt,
				})
			);
			return payout;
		});
	}

	private async transferSafely(payout: Payout): Promise<void> {
		try {
			await this.transfer(payout);
		} catch (error) {
			this.logger.error(
				`Payout ${payout.id} transfer stays pending: ${stripeErrorDetails(error)}`
			);
		}
	}

	private async transfer(payout: Payout): Promise<void> {
		const account = await this.entityManager
			.fork()
			.findOneOrFail(PaymentAccount, { organizationId: payout.organizationId });
		const existing = await this.existingTransfer(payout);
		if (existing) {
			await this.complete(payout.id, existing);
			return;
		}
		try {
			const transfer = await this.stripe.transfers.create(
				{
					amount: payout.amountCents,
					currency: STRIPE_CURRENCY,
					destination: account.stripeAccountId,
					transfer_group: transferGroup(payout),
					metadata: {
						[StripeMetadataKey.PAYOUT_ID]: payout.id,
						[StripeMetadataKey.ORGANIZATION_ID]: payout.organizationId,
					},
				},
				{
					idempotencyKey: idempotencyKey(
						StripeIdempotencyPrefix.PAYOUT,
						payout.id
					),
				}
			);
			await this.complete(payout.id, transfer);
		} catch (error) {
			await this.recordTransferFailure(payout, account, error);
		}
	}

	// An empty platform balance clears by itself, so the payout stays pending for
	// the next run; a missing destination stops the payouts of its account.
	private async recordTransferFailure(
		payout: Payout,
		account: PaymentAccount,
		error: unknown
	): Promise<void> {
		if (
			!(error instanceof Stripe.errors.StripeInvalidRequestError) ||
			error.code === StripeErrorCode.BALANCE_INSUFFICIENT
		) {
			throw error;
		}
		this.logger.warn(
			`Payout ${payout.id} transfer was rejected: ${stripeErrorDetails(error)}`
		);
		if (isStripeObjectMissing(error, StripeRequestParam.DESTINATION)) {
			await this.accounts.setPayoutsBlocked(
				account.stripeAccountId,
				PayoutsBlockedReason.ACCOUNT_CLOSED
			);
		}
		await this.fail(payout.id, error.code ?? error.message);
	}

	// Once the idempotency key may have expired, a retry must find the transfer
	// an earlier attempt created instead of paying the host twice.
	private async existingTransfer(
		payout: Payout
	): Promise<Stripe.Transfer | null> {
		const now = await databaseNow(this.entityManager);
		if (
			now.getTime() - payout.createdAt.getTime() <
			STRIPE_IDEMPOTENCY_SAFE_MILLISECONDS
		) {
			return null;
		}
		for await (const transfer of this.stripe.transfers.list({
			transfer_group: transferGroup(payout),
			limit: PAYOUT_TRANSFER_PAGE_SIZE,
		})) {
			if (transfer.metadata[StripeMetadataKey.PAYOUT_ID] === payout.id) {
				return transfer;
			}
		}
		return null;
	}

	private async complete(
		payoutId: string,
		transfer: Stripe.Transfer
	): Promise<void> {
		await this.entityManager.fork().transactional(async (manager) => {
			const payout = await manager.findOne(
				Payout,
				{ id: payoutId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!payout || payout.state !== PayoutState.PENDING) return;
			const transferredAt = stripeTimestamp(transfer.created);
			await this.ledger.post(
				manager,
				payoutTransferPosting({
					transferId: transfer.id,
					payoutId: payout.id,
					organizationId: payout.organizationId,
					amountMicroUsd: MicroUsd.parse(payout.amountMicroUsd),
					effectiveAt: transferredAt,
				})
			);
			payout.state = PayoutState.TRANSFERRED;
			payout.stripeTransferId = transfer.id;
			payout.transferredAt = transferredAt;
		});
	}

	private async fail(payoutId: string, reason: string): Promise<void> {
		await this.entityManager.fork().transactional(async (manager) => {
			const payout = await manager.findOne(
				Payout,
				{ id: payoutId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!payout || payout.state !== PayoutState.PENDING) return;
			await this.ledger.post(
				manager,
				payoutFailurePosting({
					payoutId: payout.id,
					organizationId: payout.organizationId,
					amountMicroUsd: MicroUsd.parse(payout.amountMicroUsd),
					effectiveAt: await databaseNow(manager),
				})
			);
			payout.state = PayoutState.FAILED;
			payout.failureReason = reason;
		});
	}
}
