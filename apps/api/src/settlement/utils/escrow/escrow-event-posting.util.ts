/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Address, isAddressEqual } from 'viem';
import {
	BillingLedgerAccountCode,
	BillingLedgerDescriptionCode,
	BillingLedgerSourceType,
} from '../../../billing/constants/billing.constants';
import type {
	BillingLedgerAccountReference,
	BillingLedgerPosting,
} from '../../../billing/services/ledger/billing-ledger.service';
import {
	customerCreditAccount,
	hostCreditedEarningsAccount,
	hostPendingEarningsAccount,
	platformAccount,
} from '../../../billing/utils/ledger/billing-ledger-accounts.util';
import { LedgerPostingBuilder } from '../../../billing/utils/ledger/ledger-posting-builder.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { EscrowEvent } from '../../entities/escrow-event.entity';
import { EscrowBucket } from '../../enums/escrow-bucket.enum';
import type { EscrowEventKind, EscrowMovement } from '../../types/escrow.types';
import { escrowSourceReference } from './escrow-event-record.util';

export type PostableEscrowEvent = Pick<
	EscrowEvent,
	| 'chainId'
	| 'transactionHash'
	| 'logIndex'
	| 'blockNumber'
	| 'blockTimestamp'
	| 'kind'
	| 'movements'
	| 'hostAddress'
	| 'customerOrganizationId'
	| 'hostOrganizationId'
>;

type EscrowLedgerBucket = Exclude<EscrowBucket, typeof EscrowBucket.EXTERNAL>;

const BUCKET_ACCOUNT: Readonly<
	Record<EscrowLedgerBucket, BillingLedgerAccountReference>
> = {
	[EscrowBucket.FREE]: platformAccount(BillingLedgerAccountCode.ESCROW_CUSTODY),
	[EscrowBucket.PENDING]: platformAccount(
		BillingLedgerAccountCode.ESCROW_WITHDRAWAL_PENDING
	),
	[EscrowBucket.HOST_CREDITED]: platformAccount(
		BillingLedgerAccountCode.ESCROW_HOST_CREDITED
	),
	[EscrowBucket.FEES_ACCRUED]: platformAccount(
		BillingLedgerAccountCode.ESCROW_FEES_ACCRUED
	),
	[EscrowBucket.FROZEN]: platformAccount(
		BillingLedgerAccountCode.ESCROW_FROZEN
	),
};

const CUSTOMER_BUCKETS: ReadonlySet<EscrowBucket> = new Set([
	EscrowBucket.FREE,
	EscrowBucket.PENDING,
]);

const PLATFORM_WALLET = platformAccount(
	BillingLedgerAccountCode.PLATFORM_WALLET
);
const MARKUP_PENDING = platformAccount(
	BillingLedgerAccountCode.PLATFORM_MARKUP_PENDING
);
const MARKUP_REVENUE = platformAccount(
	BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE
);

interface PostingSource {
	sourceType: string;
	descriptionCode: string;
}

const EVENT_SOURCE: Readonly<Partial<Record<EscrowEventKind, PostingSource>>> =
	{
		Deposited: {
			sourceType: BillingLedgerSourceType.ESCROW_DEPOSIT,
			descriptionCode: BillingLedgerDescriptionCode.ESCROW_DEPOSITED,
		},
		WithdrawalRequested: {
			sourceType: BillingLedgerSourceType.ESCROW_WITHDRAWAL_REQUEST,
			descriptionCode: BillingLedgerDescriptionCode.ESCROW_WITHDRAWAL_REQUESTED,
		},
		WithdrawalCancelled: {
			sourceType: BillingLedgerSourceType.ESCROW_WITHDRAWAL_REQUEST,
			descriptionCode: BillingLedgerDescriptionCode.ESCROW_WITHDRAWAL_CANCELLED,
		},
		Withdrawn: {
			sourceType: BillingLedgerSourceType.ESCROW_WITHDRAWAL,
			descriptionCode: BillingLedgerDescriptionCode.ESCROW_WITHDRAWN,
		},
		Claimed: {
			sourceType: BillingLedgerSourceType.ESCROW_CLAIM,
			descriptionCode: BillingLedgerDescriptionCode.ESCROW_CLAIMED,
		},
		HostWithdrawn: {
			sourceType: BillingLedgerSourceType.ESCROW_HOST_WITHDRAWAL,
			descriptionCode: BillingLedgerDescriptionCode.ESCROW_HOST_WITHDRAWN,
		},
		FeesSwept: {
			sourceType: BillingLedgerSourceType.ESCROW_FEE_SWEEP,
			descriptionCode: BillingLedgerDescriptionCode.ESCROW_FEES_SWEPT,
		},
		AccountBlocked: {
			sourceType: BillingLedgerSourceType.ESCROW_FREEZE,
			descriptionCode: BillingLedgerDescriptionCode.ESCROW_FROZEN,
		},
		FrozenReleased: {
			sourceType: BillingLedgerSourceType.ESCROW_FROZEN_RELEASE,
			descriptionCode: BillingLedgerDescriptionCode.ESCROW_FROZEN_RELEASED,
		},
	};

const CUSTOMER_EVENTS: ReadonlySet<EscrowEventKind> = new Set([
	'Deposited',
	'Withdrawn',
	'Claimed',
]);

function isHostCredit(move: EscrowMovement): boolean {
	return (
		CUSTOMER_BUCKETS.has(move.from) && move.to === EscrowBucket.HOST_CREDITED
	);
}

function isClaimFee(move: EscrowMovement): boolean {
	return (
		CUSTOMER_BUCKETS.has(move.from) && move.to === EscrowBucket.FEES_ACCRUED
	);
}

function isHostPayout(move: EscrowMovement): boolean {
	return (
		move.from === EscrowBucket.HOST_CREDITED &&
		move.to === EscrowBucket.EXTERNAL
	);
}

function paysPlatform(
	event: PostableEscrowEvent,
	platformAddress: Address
): boolean {
	return (
		event.hostAddress !== null &&
		isAddressEqual(event.hostAddress, platformAddress)
	);
}

function needsHost(
	event: PostableEscrowEvent,
	platformAddress: Address
): boolean {
	return (
		!paysPlatform(event, platformAddress) &&
		event.movements.some((move) => isHostCredit(move) || isHostPayout(move))
	);
}

interface DepositFinality {
	largeDepositMicroUsd: bigint;
	finalizedBlock: number | null;
}

function depositFinal(
	event: PostableEscrowEvent,
	finality: DepositFinality
): boolean {
	if (event.kind !== 'Deposited') return true;
	const deposited = event.movements
		.filter((move) => move.from === EscrowBucket.EXTERNAL)
		.reduce((total, move) => total + BigInt(move.amount), 0n);
	return (
		deposited < finality.largeDepositMicroUsd ||
		(finality.finalizedBlock !== null &&
			event.blockNumber <= finality.finalizedBlock)
	);
}

export function escrowEventPostable(
	event: PostableEscrowEvent,
	platformAddress: Address,
	finality: DepositFinality
): boolean {
	return (
		depositFinal(event, finality) &&
		(!CUSTOMER_EVENTS.has(event.kind) ||
			event.customerOrganizationId !== null) &&
		(!needsHost(event, platformAddress) || event.hostOrganizationId !== null)
	);
}

function requireOrganization(
	organizationId: string | null,
	event: PostableEscrowEvent
): string {
	if (organizationId === null) {
		throw new Error(
			`Escrow event ${escrowSourceReference(event)} is not attributed`
		);
	}
	return organizationId;
}

export function escrowEventPosting(
	event: PostableEscrowEvent,
	platformAddress: Address
): BillingLedgerPosting {
	const source = EVENT_SOURCE[event.kind];
	if (!source || event.movements.length === 0) {
		throw new Error(
			`Escrow event ${escrowSourceReference(event)} moves no funds`
		);
	}
	const platform = paysPlatform(event, platformAddress);
	const customer = () =>
		customerCreditAccount(
			requireOrganization(event.customerOrganizationId, event)
		);
	const host = () => requireOrganization(event.hostOrganizationId, event);
	const outgoing = (from: EscrowLedgerBucket) => {
		if (CUSTOMER_BUCKETS.has(from)) return customer();
		if (from === EscrowBucket.HOST_CREDITED && !platform) {
			return hostCreditedEarningsAccount(host());
		}
		return PLATFORM_WALLET;
	};
	const posting = LedgerPostingBuilder.for({
		...source,
		sourceReference: escrowSourceReference(event),
		effectiveAt: event.blockTimestamp,
		metadata: {
			kind: event.kind,
			chainId: event.chainId,
			transactionHash: event.transactionHash,
			logIndex: event.logIndex,
			blockNumber: event.blockNumber,
			customerOrganizationId: event.customerOrganizationId,
		},
	});
	for (const move of event.movements) {
		const amount = MicroUsd.parse(move.amount);
		if (move.from === EscrowBucket.EXTERNAL) {
			if (move.to === EscrowBucket.EXTERNAL) {
				throw new Error('An escrow movement must touch an escrow ledger');
			}
			posting.debit(BUCKET_ACCOUNT[move.to], amount).credit(customer(), amount);
			continue;
		}
		posting
			.debit(
				move.to === EscrowBucket.EXTERNAL
					? outgoing(move.from)
					: BUCKET_ACCOUNT[move.to],
				amount
			)
			.credit(BUCKET_ACCOUNT[move.from], amount);
		if (!platform) recognizeClaim(posting, move, amount, host);
	}
	return posting.build();
}

function recognizeClaim(
	posting: LedgerPostingBuilder,
	move: EscrowMovement,
	amount: MicroUsd,
	host: () => string
): void {
	if (isHostCredit(move)) {
		posting
			.debit(hostPendingEarningsAccount(host()), amount)
			.credit(hostCreditedEarningsAccount(host()), amount);
	}
	if (isClaimFee(move)) {
		posting.debit(MARKUP_PENDING, amount).credit(MARKUP_REVENUE, amount);
	}
}
