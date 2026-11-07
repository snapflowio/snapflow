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
	type SettlementParty,
} from '@snapflow/api-client';
import type { snapflowEscrowAbi } from '@snapflow/contracts';
import { partyAmount } from './payment-channel.ts';

type EscrowEventArgument = Extract<
	(typeof snapflowEscrowAbi)[number],
	{ type: 'event' }
>['inputs'][number]['name'];

const EVENT_LABELS: Partial<Record<EscrowEventKind, string>> = {
	[EscrowEventKind.Deposited]: 'Deposit',
	[EscrowEventKind.WithdrawalRequested]: 'Withdrawal requested',
	[EscrowEventKind.WithdrawalCancelled]: 'Withdrawal cancelled',
	[EscrowEventKind.Withdrawn]: 'Withdrawal',
	[EscrowEventKind.Claimed]: 'Claim',
	[EscrowEventKind.SessionKeySet]: 'Session key set',
	[EscrowEventKind.SessionKeyRevoked]: 'Session key revoked',
	[EscrowEventKind.AddressBlocked]: 'Wallet frozen',
	[EscrowEventKind.AddressUnblocked]: 'Wallet unfrozen',
};

const AMOUNT_ARGUMENTS: Partial<Record<EscrowEventKind, EscrowEventArgument>> =
	{
		[EscrowEventKind.Deposited]: 'amount',
		[EscrowEventKind.WithdrawalRequested]: 'amount',
		[EscrowEventKind.Withdrawn]: 'amount',
		[EscrowEventKind.SessionKeySet]: 'spendCap',
	};

function argument(
	event: EscrowEvent,
	name: EscrowEventArgument
): string | undefined {
	return event.args[name];
}

function amountArgument(event: EscrowEvent, name: EscrowEventArgument): bigint {
	return BigInt(argument(event, name) ?? 0);
}

export function escrowEventLabel(event: EscrowEvent): string {
	return EVENT_LABELS[event.kind] ?? event.kind;
}

export function escrowEventAmountMicroUsd(
	event: EscrowEvent,
	party: SettlementParty
): string | null {
	if (event.kind === EscrowEventKind.Claimed) {
		return partyAmount(
			party,
			amountArgument(event, 'hostPaid'),
			amountArgument(event, 'feePaid'),
			amountArgument(event, 'servicePaid')
		).toString();
	}
	const name = AMOUNT_ARGUMENTS[event.kind];
	return name ? amountArgument(event, name).toString() : null;
}

export function escrowEventChannelId(event: EscrowEvent): string | undefined {
	return argument(event, 'channelId');
}

export function escrowEventSessionKey(event: EscrowEvent): string | undefined {
	return argument(event, 'key');
}
