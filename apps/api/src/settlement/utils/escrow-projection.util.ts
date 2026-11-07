/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Address } from 'viem';
import { MicroUsd } from '../../common/values/micro-usd.value';
import type { EscrowSessionKey } from '../entities/escrow-session-key.entity';
import type { EscrowLog } from '../types/escrow.types';
import { chainTimestamp } from './escrow-event-record.util';

export interface EscrowAccountState {
	balanceMicroUsd: MicroUsd;
	pendingWithdrawalMicroUsd: MicroUsd;
	withdrawalReadyAt: Date | null;
	blocked: boolean;
}

export const EMPTY_ESCROW_ACCOUNT: Readonly<EscrowAccountState> = {
	balanceMicroUsd: MicroUsd.ZERO,
	pendingWithdrawalMicroUsd: MicroUsd.ZERO,
	withdrawalReadyAt: null,
	blocked: false,
};

const NO_WITHDRAWAL = {
	pendingWithdrawalMicroUsd: MicroUsd.ZERO,
	withdrawalReadyAt: null,
} as const;

// The address whose escrow account an event changes, or null when it changes
// none. A claim moves the customer's balance; the host is paid in USDC
// outside the escrow.
export function escrowAccountAddress(log: EscrowLog): Address | null {
	switch (log.eventName) {
		case 'Deposited':
		case 'Claimed':
		case 'WithdrawalRequested':
		case 'WithdrawalCancelled':
		case 'Withdrawn':
			return log.args.customer;
		case 'AddressBlocked':
		case 'AddressUnblocked':
			return log.args.account;
		default:
			return null;
	}
}

// Folds one event into the account it changes, mirroring the contract: a
// withdrawal request replaces the previous one, and withdrawing or cancelling
// clears it.
export function projectEscrowAccount(
	state: Readonly<EscrowAccountState>,
	log: EscrowLog
): EscrowAccountState {
	switch (log.eventName) {
		case 'Deposited':
			return {
				...state,
				balanceMicroUsd: state.balanceMicroUsd.add(
					MicroUsd.of(log.args.amount)
				),
			};
		case 'Claimed':
			return {
				...state,
				balanceMicroUsd: state.balanceMicroUsd.subtract(
					MicroUsd.of(
						log.args.hostPaid + log.args.feePaid + log.args.servicePaid
					)
				),
			};
		case 'WithdrawalRequested':
			return {
				...state,
				pendingWithdrawalMicroUsd: MicroUsd.of(log.args.amount),
				withdrawalReadyAt: chainTimestamp(log.args.readyAt),
			};
		case 'WithdrawalCancelled':
			return { ...state, ...NO_WITHDRAWAL };
		case 'Withdrawn':
			return {
				...state,
				...NO_WITHDRAWAL,
				balanceMicroUsd: state.balanceMicroUsd.subtract(
					MicroUsd.of(log.args.amount)
				),
			};
		case 'AddressBlocked':
			return { ...state, blocked: true };
		case 'AddressUnblocked':
			return { ...state, blocked: false };
		default:
			return { ...state };
	}
}

type SessionKeyGrant = Pick<
	EscrowSessionKey,
	| 'customerAddress'
	| 'keyAddress'
	| 'spendCapMicroUsd'
	| 'hourlyCapMicroUsd'
	| 'expiresAt'
	| 'activatedAt'
>;

type SessionKeyRevocation = Pick<
	EscrowSessionKey,
	'customerAddress' | 'keyAddress'
> & { revokedAt: Date };

export type SessionKeyChange =
	| { granted: SessionKeyGrant }
	| { revoked: SessionKeyRevocation };

// Setting a key again replaces its limits and restarts it, like the contract
// does; the contract activates a key in the block that sets it.
export function sessionKeyChange(
	log: EscrowLog,
	blockTimestamp: Date
): SessionKeyChange | null {
	switch (log.eventName) {
		case 'SessionKeySet':
			return {
				granted: {
					customerAddress: log.args.customer,
					keyAddress: log.args.key,
					spendCapMicroUsd: log.args.spendCap.toString(),
					hourlyCapMicroUsd: log.args.hourlyCap.toString(),
					expiresAt: chainTimestamp(log.args.expiry),
					activatedAt: blockTimestamp,
				},
			};
		case 'SessionKeyRevoked':
			return {
				revoked: {
					customerAddress: log.args.customer,
					keyAddress: log.args.key,
					revokedAt: blockTimestamp,
				},
			};
		default:
			return null;
	}
}
