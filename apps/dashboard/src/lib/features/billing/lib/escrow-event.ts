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
	EscrowEventParty,
} from '@snapflow/api-client';

const EVENT_ARGUMENT = {
	amount: 'amount',
	channelId: 'channelId',
	feePaid: 'feePaid',
	hostPaid: 'hostPaid',
	key: 'key',
	servicePaid: 'servicePaid',
	spendCap: 'spendCap',
} as const;

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

const AMOUNT_ARGUMENTS: Partial<Record<EscrowEventKind, string>> = {
	[EscrowEventKind.Deposited]: EVENT_ARGUMENT.amount,
	[EscrowEventKind.WithdrawalRequested]: EVENT_ARGUMENT.amount,
	[EscrowEventKind.Withdrawn]: EVENT_ARGUMENT.amount,
	[EscrowEventKind.SessionKeySet]: EVENT_ARGUMENT.spendCap,
};

function argument(event: EscrowEvent, name: string): bigint {
	return BigInt(event.args[name] ?? 0);
}

export function escrowEventLabel(event: EscrowEvent): string {
	return EVENT_LABELS[event.kind] ?? event.kind;
}

export function isCustomerEvent(event: EscrowEvent): boolean {
	return event.parties.includes(EscrowEventParty.Customer);
}

export function isHostClaim(event: EscrowEvent): boolean {
	return (
		event.kind === EscrowEventKind.Claimed &&
		event.parties.includes(EscrowEventParty.Host)
	);
}

export function escrowEventAmountMicroUsd(
	event: EscrowEvent,
	party: EscrowEventParty
): string | null {
	if (event.kind === EscrowEventKind.Claimed) {
		const hostPaid = argument(event, EVENT_ARGUMENT.hostPaid);
		const amount =
			party === EscrowEventParty.Host
				? hostPaid
				: hostPaid +
					argument(event, EVENT_ARGUMENT.feePaid) +
					argument(event, EVENT_ARGUMENT.servicePaid);
		return amount.toString();
	}
	const name = AMOUNT_ARGUMENTS[event.kind];
	return name ? argument(event, name).toString() : null;
}

export function escrowEventChannelId(event: EscrowEvent): string | undefined {
	return event.args[EVENT_ARGUMENT.channelId];
}

export function escrowEventSessionKey(event: EscrowEvent): string | undefined {
	return event.args[EVENT_ARGUMENT.key];
}
