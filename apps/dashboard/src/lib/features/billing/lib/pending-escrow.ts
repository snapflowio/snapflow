/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type EscrowAccount,
	type EscrowPendingChanges,
	PendingDepositKind,
	PendingDepositStage,
	PendingWithdrawalChangeKind,
} from '@snapflow/api-client';
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';

const SETTLEMENT_BLOCK_SECONDS = 2;
export const ESCROW_LAG_NOTICE_BLOCKS = 150;

export interface LocalEscrowChange {
	transactionHash: string;
	amount: bigint;
	blockNumber: bigint;
}

export interface LocalEscrowActivity {
	deposits: readonly LocalEscrowChange[];
	withdrawals: readonly LocalEscrowChange[];
	cancelling: boolean;
	completing: boolean;
}

export const PendingDepositState = {
	Sent: 'sent',
	Confirming: 'confirming',
	Finalizing: 'finalizing',
} as const;

export type PendingDepositState =
	(typeof PendingDepositState)[keyof typeof PendingDepositState];

export interface PendingDepositRow {
	kind: 'deposit';
	id: string;
	source: PendingDepositKind;
	state: PendingDepositState;
	amountMicroUsd: bigint;
	transactionHash: string;
	etaSeconds: number | null;
}

export const PendingWithdrawalState = {
	Requesting: 'requesting',
	Locked: 'locked',
	Unlocked: 'unlocked',
	Frozen: 'frozen',
	Cancelling: 'cancelling',
	Completing: 'completing',
} as const;

export type PendingWithdrawalState =
	(typeof PendingWithdrawalState)[keyof typeof PendingWithdrawalState];

export interface PendingWithdrawalRow {
	kind: 'withdrawal';
	id: string;
	state: PendingWithdrawalState;
	amountMicroUsd: bigint;
	availableAt: string | null;
	cancellable: boolean;
	transactionHash: string | null;
}

export type PendingEscrowRow = PendingDepositRow | PendingWithdrawalRow;

interface StatusPresentation {
	shape: StatusRingShape;
	tone: StatusRingTone;
	live: boolean;
}

const DEPOSIT_STATUS = {
	[PendingDepositState.Sent]: { shape: 'dashed', tone: 'neutral', live: true },
	[PendingDepositState.Confirming]: {
		shape: 'half',
		tone: 'neutral',
		live: true,
	},
	[PendingDepositState.Finalizing]: {
		shape: 'most',
		tone: 'neutral',
		live: true,
	},
} as const satisfies Record<PendingDepositState, StatusPresentation>;

const WITHDRAWAL_STATUS = {
	[PendingWithdrawalState.Requesting]: {
		shape: 'dashed',
		tone: 'neutral',
		live: true,
	},
	[PendingWithdrawalState.Locked]: {
		shape: 'paused',
		tone: 'neutral',
		live: false,
	},
	[PendingWithdrawalState.Unlocked]: {
		shape: 'most',
		tone: 'neutral',
		live: false,
	},
	[PendingWithdrawalState.Frozen]: {
		shape: 'paused',
		tone: 'error',
		live: false,
	},
	[PendingWithdrawalState.Cancelling]: {
		shape: 'half',
		tone: 'neutral',
		live: true,
	},
	[PendingWithdrawalState.Completing]: {
		shape: 'half',
		tone: 'neutral',
		live: true,
	},
} as const satisfies Record<PendingWithdrawalState, StatusPresentation>;

export function pendingRowStatus(row: PendingEscrowRow): StatusPresentation {
	return row.kind === 'deposit'
		? DEPOSIT_STATUS[row.state]
		: WITHDRAWAL_STATUS[row.state];
}

const DEPOSIT_STAGE_STATES = {
	[PendingDepositStage.Confirming]: PendingDepositState.Confirming,
	[PendingDepositStage.Finalizing]: PendingDepositState.Finalizing,
} as const satisfies Record<PendingDepositStage, PendingDepositState>;

function sameHash(left: string, right: string): boolean {
	return left.toLowerCase() === right.toLowerCase();
}

function remainingSeconds(confirmations: number, required: number): number {
	return Math.max(0, required - confirmations) * SETTLEMENT_BLOCK_SECONDS;
}

function depositRows(
	api: EscrowPendingChanges | undefined,
	local: LocalEscrowActivity
): PendingDepositRow[] {
	const seen = api?.deposits ?? [];
	const observed: PendingDepositRow[] = seen.map((deposit) => ({
		kind: 'deposit',
		id: `${deposit.transactionHash}:${deposit.logIndex}`,
		source: deposit.kind,
		state: DEPOSIT_STAGE_STATES[deposit.stage],
		amountMicroUsd: BigInt(deposit.amountMicroUsd),
		transactionHash: deposit.transactionHash,
		etaSeconds: remainingSeconds(
			deposit.confirmations,
			deposit.requiredConfirmations
		),
	}));
	const sent: PendingDepositRow[] = local.deposits
		.filter(
			(change) =>
				!seen.some((deposit) =>
					sameHash(deposit.transactionHash, change.transactionHash)
				)
		)
		.map((change) => ({
			kind: 'deposit',
			id: change.transactionHash,
			source: PendingDepositKind.Escrow,
			state: PendingDepositState.Sent,
			amountMicroUsd: change.amount,
			transactionHash: change.transactionHash,
			etaSeconds: null,
		}));
	return [...sent, ...observed];
}

function hasChange(
	api: EscrowPendingChanges | undefined,
	kind: PendingWithdrawalChangeKind
) {
	return api?.withdrawalChanges.find((change) => change.kind === kind);
}

function heldWithdrawalState(
	account: EscrowAccount,
	api: EscrowPendingChanges | undefined,
	local: LocalEscrowActivity
): PendingWithdrawalState {
	if (local.completing || hasChange(api, PendingWithdrawalChangeKind.Withdrawn))
		return PendingWithdrawalState.Completing;
	if (
		local.cancelling ||
		hasChange(api, PendingWithdrawalChangeKind.WithdrawalCancelled)
	)
		return PendingWithdrawalState.Cancelling;
	if (account.blockedAt) return PendingWithdrawalState.Frozen;
	return account.withdrawalUnlocksInSeconds === 0
		? PendingWithdrawalState.Unlocked
		: PendingWithdrawalState.Locked;
}

function withdrawalRow(
	account: EscrowAccount,
	api: EscrowPendingChanges | undefined,
	local: LocalEscrowActivity
): PendingWithdrawalRow | null {
	const pending = BigInt(account.pendingMicroUsd);
	if (pending > 0n) {
		return {
			kind: 'withdrawal',
			id: 'withdrawal',
			state: heldWithdrawalState(account, api, local),
			amountMicroUsd: pending,
			availableAt: account.withdrawalAvailableAt,
			cancellable: account.withdrawalCancellable,
			transactionHash: null,
		};
	}
	const requested =
		hasChange(api, PendingWithdrawalChangeKind.WithdrawalRequested) ??
		local.withdrawals[0];
	if (!requested) return null;
	const amount =
		'amountMicroUsd' in requested
			? BigInt(requested.amountMicroUsd)
			: requested.amount;
	return {
		kind: 'withdrawal',
		id: 'withdrawal',
		state: PendingWithdrawalState.Requesting,
		amountMicroUsd: amount,
		availableAt: null,
		cancellable: false,
		transactionHash: requested.transactionHash,
	};
}

export function pendingEscrowRows(
	account: EscrowAccount,
	api: EscrowPendingChanges | undefined,
	local: LocalEscrowActivity
): PendingEscrowRow[] {
	const withdrawal = withdrawalRow(account, api, local);
	return [...depositRows(api, local), ...(withdrawal ? [withdrawal] : [])];
}

export function escrowIndexingDelayed(
	api: EscrowPendingChanges | undefined
): boolean {
	if (!api || api.indexedThroughBlock === null) return false;
	return api.latestBlock - api.indexedThroughBlock > ESCROW_LAG_NOTICE_BLOCKS;
}
