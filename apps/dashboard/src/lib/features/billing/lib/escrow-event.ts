/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type EscrowEvent,
	EscrowEventKind,
	SettlementParty,
} from '@snapflow/api-client';
import type { snapflowEscrowAbi } from '@snapflow/contracts';
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatHourlyPrice, formatUsd } from '#lib/utils/usd.ts';
import { unixSecondsDate } from './escrow-terms.ts';

type EscrowEventArgument = Extract<
	(typeof snapflowEscrowAbi)[number],
	{ type: 'event' }
>['inputs'][number]['name'];

const EVENT_LABELS: Partial<Record<EscrowEventKind, string>> = {
	[EscrowEventKind.Deposited]: 'Deposit',
	[EscrowEventKind.WithdrawalRequested]: 'Withdrawal requested',
	[EscrowEventKind.WithdrawalCancelled]: 'Withdrawal cancelled',
	[EscrowEventKind.Withdrawn]: 'Withdrawal',
	[EscrowEventKind.AutoTopUpSet]: 'Auto top-up set',
	[EscrowEventKind.AutoTopUpExecuted]: 'Auto top-up',
	[EscrowEventKind.AutoTopUpDisabled]: 'Auto top-up turned off',
	[EscrowEventKind.SignerAuthorized]: 'Automatic payments turned on',
	[EscrowEventKind.SignerThawed]: 'Automatic payments stopping',
	[EscrowEventKind.SignerRevoked]: 'Automatic payments key revoked',
	[EscrowEventKind.SignerLimitRaised]: 'Hourly spending limit raised',
	[EscrowEventKind.SignerLimitLowerScheduled]: 'Hourly spending limit lowering',
	[EscrowEventKind.Claimed]: 'Claim',
	[EscrowEventKind.HostWithdrawn]: 'Payout',
	[EscrowEventKind.RelayFeePaid]: 'Relay fee',
	[EscrowEventKind.PayoutAddressSet]: 'Payout address set',
	[EscrowEventKind.AccountBlocked]: 'Wallet frozen',
	[EscrowEventKind.AccountUnblocked]: 'Wallet unfrozen',
	[EscrowEventKind.Frozen]: 'Value frozen',
	[EscrowEventKind.FrozenReleased]: 'Frozen value released',
};

const CUSTOMER_LABELS: Partial<Record<EscrowEventKind, string>> = {
	[EscrowEventKind.Claimed]: 'Payment to host',
	[EscrowEventKind.RelayFeePaid]: 'Network fee',
};

const AMOUNT_ARGUMENTS: Partial<Record<EscrowEventKind, EscrowEventArgument>> =
	{
		[EscrowEventKind.Deposited]: 'amount',
		[EscrowEventKind.WithdrawalRequested]: 'amount',
		[EscrowEventKind.WithdrawalCancelled]: 'amount',
		[EscrowEventKind.Withdrawn]: 'amount',
		[EscrowEventKind.AutoTopUpSet]: 'amount',
		[EscrowEventKind.AutoTopUpExecuted]: 'amount',
		[EscrowEventKind.HostWithdrawn]: 'amount',
		[EscrowEventKind.RelayFeePaid]: 'amount',
		[EscrowEventKind.Frozen]: 'amount',
		[EscrowEventKind.FrozenReleased]: 'amount',
	};

export const CUSTOMER_MONEY_EVENT_KINDS = [
	EscrowEventKind.Deposited,
	EscrowEventKind.AutoTopUpExecuted,
	EscrowEventKind.WithdrawalRequested,
	EscrowEventKind.WithdrawalCancelled,
	EscrowEventKind.Withdrawn,
	EscrowEventKind.Claimed,
	EscrowEventKind.RelayFeePaid,
	EscrowEventKind.Frozen,
	EscrowEventKind.FrozenReleased,
	EscrowEventKind.AccountBlocked,
	EscrowEventKind.AccountUnblocked,
] as const satisfies readonly EscrowEventKind[];

function argument(
	event: EscrowEvent,
	name: EscrowEventArgument
): string | undefined {
	return event.args[name];
}

function amountArgument(event: EscrowEvent, name: EscrowEventArgument): bigint {
	return BigInt(argument(event, name) ?? 0);
}

export function escrowEventLabel(
	event: EscrowEvent,
	party?: SettlementParty
): string {
	const customerLabel =
		party === SettlementParty.Customer ? CUSTOMER_LABELS[event.kind] : null;
	return customerLabel ?? EVENT_LABELS[event.kind] ?? event.kind;
}

export function escrowEventAmountMicroUsd(
	event: EscrowEvent,
	party: SettlementParty
): string | null {
	if (event.kind === EscrowEventKind.Claimed) {
		const paid = amountArgument(event, 'paid');
		const share =
			party === SettlementParty.Host
				? paid - amountArgument(event, 'fee')
				: paid;
		return share.toString();
	}
	const name = AMOUNT_ARGUMENTS[event.kind];
	return name ? amountArgument(event, name).toString() : null;
}

const Direction = { In: 1, Out: -1, Neutral: 0 } as const;
type Direction = (typeof Direction)[keyof typeof Direction];

const CUSTOMER_DIRECTIONS: Partial<Record<EscrowEventKind, Direction>> = {
	[EscrowEventKind.Deposited]: Direction.In,
	[EscrowEventKind.AutoTopUpExecuted]: Direction.In,
	[EscrowEventKind.FrozenReleased]: Direction.In,
	[EscrowEventKind.Withdrawn]: Direction.Out,
	[EscrowEventKind.Claimed]: Direction.Out,
	[EscrowEventKind.RelayFeePaid]: Direction.Out,
	[EscrowEventKind.Frozen]: Direction.Out,
};

const HOST_DIRECTIONS: Partial<Record<EscrowEventKind, Direction>> = {
	[EscrowEventKind.Claimed]: Direction.In,
	[EscrowEventKind.FrozenReleased]: Direction.In,
	[EscrowEventKind.HostWithdrawn]: Direction.Out,
	[EscrowEventKind.RelayFeePaid]: Direction.Out,
	[EscrowEventKind.Frozen]: Direction.Out,
};

const DIRECTIONS = {
	[SettlementParty.Customer]: CUSTOMER_DIRECTIONS,
	[SettlementParty.Host]: HOST_DIRECTIONS,
} as const satisfies Record<
	SettlementParty,
	Partial<Record<EscrowEventKind, Direction>>
>;

export function escrowEventSignedMicroUsd(
	event: EscrowEvent,
	party: SettlementParty
): bigint | null {
	const amount = escrowEventAmountMicroUsd(event, party);
	if (amount === null) return null;
	const direction = DIRECTIONS[party][event.kind] ?? Direction.Neutral;
	return direction === Direction.Out ? -BigInt(amount) : BigInt(amount);
}

export function escrowEventSigned(
	event: EscrowEvent,
	party: SettlementParty
): boolean {
	return DIRECTIONS[party][event.kind] === Direction.In;
}

export function escrowEventSignedAmount(
	event: EscrowEvent,
	party: SettlementParty
): string | null {
	const amount = escrowEventSignedMicroUsd(event, party);
	if (amount === null) return null;
	const sign = escrowEventSigned(event, party) ? '+' : '';
	return amount < 0n
		? `-${formatUsd((-amount).toString())}`
		: `${sign}${formatUsd(amount.toString())}`;
}

export function escrowEventReverted(event: EscrowEvent): boolean {
	return event.kind === EscrowEventKind.WithdrawalCancelled;
}

export interface EscrowEventStatus {
	shape: StatusRingShape;
	tone: StatusRingTone;
	label: string;
}

const NEUTRAL_DONE: EscrowEventStatus = {
	shape: 'check',
	tone: 'neutral',
	label: 'Confirmed',
};

const EVENT_STATUSES: Partial<Record<EscrowEventKind, EscrowEventStatus>> = {
	[EscrowEventKind.Deposited]: {
		shape: 'check',
		tone: 'success',
		label: 'Completed',
	},
	[EscrowEventKind.AutoTopUpExecuted]: {
		shape: 'check',
		tone: 'success',
		label: 'Completed',
	},
	[EscrowEventKind.WithdrawalRequested]: {
		shape: 'paused',
		tone: 'neutral',
		label: 'Requested',
	},
	[EscrowEventKind.WithdrawalCancelled]: {
		shape: 'cross',
		tone: 'neutral',
		label: 'Cancelled',
	},
	[EscrowEventKind.AccountBlocked]: {
		shape: 'alert',
		tone: 'error',
		label: 'Blocked',
	},
	[EscrowEventKind.Frozen]: { shape: 'alert', tone: 'error', label: 'Frozen' },
	[EscrowEventKind.SignerRevoked]: {
		shape: 'cross',
		tone: 'neutral',
		label: 'Revoked',
	},
	[EscrowEventKind.SignerThawed]: {
		shape: 'paused',
		tone: 'neutral',
		label: 'Stopped',
	},
	[EscrowEventKind.AutoTopUpDisabled]: {
		shape: 'cross',
		tone: 'neutral',
		label: 'Off',
	},
};

export function escrowEventStatus(event: EscrowEvent): EscrowEventStatus {
	return EVENT_STATUSES[event.kind] ?? NEUTRAL_DONE;
}

function dateArgument(
	event: EscrowEvent,
	name: EscrowEventArgument
): string | null {
	const seconds = argument(event, name);
	return seconds ? formatDateTime(unixSecondsDate(seconds)) : null;
}

function rateArgument(event: EscrowEvent): string | null {
	const hourlyCap = argument(event, 'hourlyCap');
	return hourlyCap ? formatHourlyPrice(hourlyCap) : null;
}

export function escrowEventDetail(event: EscrowEvent): string | null {
	switch (event.kind) {
		case EscrowEventKind.SignerAuthorized:
		case EscrowEventKind.SignerLimitRaised:
			return rateArgument(event);
		case EscrowEventKind.SignerLimitLowerScheduled: {
			const rate = rateArgument(event);
			const effectiveAt = dateArgument(event, 'effectiveAt');
			return rate && effectiveAt ? `${rate} from ${effectiveAt}` : rate;
		}
		case EscrowEventKind.AccountBlocked: {
			const until = dateArgument(event, 'until');
			return until ? `until ${until}` : null;
		}
		default:
			return null;
	}
}

export function escrowEventChannelId(event: EscrowEvent): string | undefined {
	return argument(event, 'channelId');
}

export function escrowEventReference(event: EscrowEvent): string | undefined {
	return escrowEventChannelId(event) ?? argument(event, 'signer');
}

const MONTH_DIGITS = 2;

export function escrowEventMonth(event: EscrowEvent): string {
	const date = new Date(event.blockTimestamp);
	const month = String(date.getUTCMonth() + 1).padStart(MONTH_DIGITS, '0');
	return `${date.getUTCFullYear()}-${month}`;
}
