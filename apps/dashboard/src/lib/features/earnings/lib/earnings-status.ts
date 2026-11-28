/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type HostEscrowBalance,
	type HostMachineEarnings,
	SanctionsStatus,
} from '@snapflow/api-client';
import type { BadgeVariant } from '#lib/components/ui/badge.svelte';
import type {
	StatusRingShape,
	StatusRingTone,
} from '#lib/components/ui/status/status-ring.svelte';

const MILLISECONDS_PER_SECOND = 1000;
const PERCENT_SCALE = 100;

export interface EarningsStatus {
	label: string;
	shape: StatusRingShape;
	tone: StatusRingTone;
	live?: boolean;
	description: string | null;
}

export const EARNINGS_STATUS = {
	earning: {
		label: 'Earning',
		shape: 'half',
		tone: 'neutral',
		description: "Signed by renters. Settles on the machine's next payout.",
	},
	ready: {
		label: 'Ready',
		shape: 'most',
		tone: 'neutral',
		description: "Settled to the escrow. Sent with the machine's next payout.",
	},
	payingOut: {
		label: 'Paying out',
		shape: 'most',
		tone: 'neutral',
		live: true,
		description: 'Sends on the machine’s next check.',
	},
	paidOut: {
		label: 'Paid out',
		shape: 'check',
		tone: 'success',
		description: null,
	},
	held: {
		label: 'Held',
		shape: 'paused',
		tone: 'error',
		description: 'Held while the machine key is blocked. Never seized.',
	},
	retired: {
		label: 'Retired key',
		shape: 'dashed',
		tone: 'neutral',
		description: 'Still pays out what this key earned.',
	},
} as const satisfies Record<string, EarningsStatus>;

export function machineEarningsStatus(
	machine: Pick<HostMachineEarnings, 'blockedAt' | 'current' | 'payoutDue'>
): EarningsStatus {
	if (machine.blockedAt) return EARNINGS_STATUS.held;
	if (!machine.current) return EARNINGS_STATUS.retired;
	if (machine.payoutDue) return EARNINGS_STATUS.payingOut;
	return EARNINGS_STATUS.earning;
}

export const WALLET_SCREENING = {
	[SanctionsStatus.Clear]: {
		label: 'Screened',
		shape: 'check',
		tone: 'success',
		description: 'Passed sanctions screening.',
	},
	[SanctionsStatus.Unchecked]: {
		label: 'Screening',
		shape: 'half',
		tone: 'neutral',
		live: true,
		description: 'Listings take rentals once screening passes.',
	},
	[SanctionsStatus.Blocked]: {
		label: 'Blocked',
		shape: 'cross',
		tone: 'error',
		description: 'Failed sanctions screening. Public listings are paused.',
	},
} as const satisfies Record<SanctionsStatus, EarningsStatus>;

export interface NextPayout {
	machine: HostMachineEarnings;
	netMicroUsd: string;
	feeMicroUsd: string;
	grossMicroUsd: string;
	at: string;
}

export function nextPayout(
	balance: Pick<HostEscrowBalance, 'machines'>
): NextPayout | null {
	const due = balance.machines
		.flatMap((machine) =>
			machine.payoutDue &&
			machine.nextPayoutAt &&
			machine.netPayoutMicroUsd &&
			machine.relayFeeMicroUsd
				? [
						{
							machine,
							netMicroUsd: machine.netPayoutMicroUsd,
							feeMicroUsd: machine.relayFeeMicroUsd,
							grossMicroUsd: machine.pendingMicroUsd,
							at: machine.nextPayoutAt,
						},
					]
				: []
		)
		.toSorted((left, right) => Date.parse(left.at) - Date.parse(right.at));
	return due[0] ?? null;
}

export function payoutProgressPercent(
	machine: Pick<
		HostMachineEarnings,
		'pendingMicroUsd' | 'payoutThresholdMicroUsd'
	>
): number | null {
	if (!machine.payoutThresholdMicroUsd) return null;
	const threshold = BigInt(machine.payoutThresholdMicroUsd);
	if (threshold <= 0n) return null;
	const pending = BigInt(machine.pendingMicroUsd);
	const percent = Number((pending * BigInt(PERCENT_SCALE)) / threshold);
	return Math.min(PERCENT_SCALE, percent);
}

export function claimDeadlineSoon(
	machine: Pick<HostMachineEarnings, 'claimDeadlineAt'>,
	noticeSeconds: number,
	now: number
): boolean {
	if (!machine.claimDeadlineAt) return false;
	return (
		Date.parse(machine.claimDeadlineAt) - now <=
		noticeSeconds * MILLISECONDS_PER_SECOND
	);
}

export function hasMicroUsd(value: string | null | undefined): boolean {
	return value !== null && value !== undefined && BigInt(value) > 0n;
}

export const PAYOUT_PERCENT_SCALE = PERCENT_SCALE;

export function statusLabelProps(status: EarningsStatus) {
	return {
		label: status.label,
		shape: status.shape,
		tone: status.tone,
		live: status.live ?? false,
		description: status.description,
	};
}

const TONE_BADGE: Record<StatusRingTone, BadgeVariant> = {
	neutral: 'neutral',
	success: 'success',
	warning: 'warning',
	error: 'error',
};

export function statusBadgeVariant(status: EarningsStatus): BadgeVariant {
	return TONE_BADGE[status.tone];
}

export type WalletReadinessTone = 'success' | 'warning' | 'error';

export interface WalletReadiness {
	label: string;
	tone: WalletReadinessTone;
	description: string | null;
}

const WALLET_READINESS = {
	[SanctionsStatus.Clear]: {
		label: 'Ready',
		tone: 'success',
		description: WALLET_SCREENING[SanctionsStatus.Clear].description,
	},
	[SanctionsStatus.Unchecked]: {
		label: 'Screening',
		tone: 'warning',
		description: WALLET_SCREENING[SanctionsStatus.Unchecked].description,
	},
	[SanctionsStatus.Blocked]: {
		label: 'Blocked',
		tone: 'error',
		description: WALLET_SCREENING[SanctionsStatus.Blocked].description,
	},
} as const satisfies Record<SanctionsStatus, WalletReadiness>;

const WALLET_SETUP_REQUIRED: WalletReadiness = {
	label: 'Setup required',
	tone: 'warning',
	description: 'Machines can be listed publicly once a payout wallet is set.',
};

export function walletReadiness(
	status: SanctionsStatus | undefined
): WalletReadiness {
	return status ? WALLET_READINESS[status] : WALLET_SETUP_REQUIRED;
}
