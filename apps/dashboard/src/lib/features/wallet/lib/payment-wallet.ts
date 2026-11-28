/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type PaymentWallet,
	PaymentWalletPurpose,
	PayoutReadiness,
	SanctionsStatus,
} from '@snapflow/api-client';
import { isAddress, isAddressEqual } from 'viem';
import type { StatusBadge } from '#lib/components/ui/status-badge.ts';

const ADDRESS_PREFIX_LENGTH = 6;
const ADDRESS_SUFFIX_LENGTH = 4;

export const SANCTIONS_BADGES = {
	[SanctionsStatus.Clear]: { label: 'Screened', variant: 'success' },
	[SanctionsStatus.Blocked]: { label: 'Sanctions block', variant: 'error' },
	[SanctionsStatus.Unchecked]: { label: 'Not screened', variant: 'neutral' },
} as const satisfies Record<SanctionsStatus, StatusBadge>;

export const ESCROW_FROZEN_BADGE: StatusBadge = {
	label: 'Frozen',
	variant: 'error',
};

interface PayoutReadinessCopy {
	badge: StatusBadge;
	title: string;
	description: string;
}

export const PAYOUT_READINESS = {
	[PayoutReadiness.Ready]: {
		badge: { label: 'Ready', variant: 'success' },
		title: 'Payouts are ready',
		description:
			'Claims credit your earnings in the escrow and payouts send them to your payout wallet.',
	},
	[PayoutReadiness.Blocked]: {
		badge: { label: 'Blocked', variant: 'error' },
		title: 'Payouts are blocked',
		description:
			'Sanctions screening blocked the payout wallet, so payouts and public listings are paused. Contact support if you believe this is a mistake.',
	},
	[PayoutReadiness.NotSetUp]: {
		badge: { label: 'Not set up', variant: 'warning' },
		title: 'No payout wallet',
		description:
			'Link a payout wallet to list machines and receive earnings in USDC.',
	},
} as const satisfies Record<PayoutReadiness, PayoutReadinessCopy>;

interface WalletPurposeCopy {
	label: string;
	managedBy: string;
	unlinkWarning: string;
}

export const WALLET_PURPOSES = {
	[PaymentWalletPurpose.Funding]: {
		label: 'funding wallet',
		managedBy: 'billing',
		unlinkWarning:
			'New sandboxes cannot start until another funding wallet is linked, and its escrow balance stays with it: only that wallet can withdraw it.',
	},
	[PaymentWalletPurpose.Payout]: {
		label: 'payout wallet',
		managedBy: 'payouts',
		unlinkWarning:
			'Your listings stop accepting rentals until another payout wallet is linked.',
	},
} as const satisfies Record<PaymentWalletPurpose, WalletPurposeCopy>;

export function linkedWallet(
	wallets: readonly PaymentWallet[] | undefined,
	purpose: PaymentWalletPurpose
): PaymentWallet | undefined {
	return wallets?.find((wallet) => wallet.purpose === purpose);
}

export function sameAddress(
	left: string | null | undefined,
	right: string | null | undefined
): boolean {
	return Boolean(
		left &&
			right &&
			isAddress(left) &&
			isAddress(right) &&
			isAddressEqual(left, right)
	);
}

export function shortAddress(address: string): string {
	return `${address.slice(0, ADDRESS_PREFIX_LENGTH)}…${address.slice(-ADDRESS_SUFFIX_LENGTH)}`;
}
