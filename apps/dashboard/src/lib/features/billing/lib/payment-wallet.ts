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
import type { BadgeProps } from '#lib/components/ui/badge.svelte';

const ADDRESS_PREFIX_LENGTH = 6;
const ADDRESS_SUFFIX_LENGTH = 4;

interface StatusBadge {
	label: string;
	variant: BadgeProps['variant'];
}

export const SANCTIONS_BADGES = {
	[SanctionsStatus.Clear]: { label: 'Screened', variant: 'green' },
	[SanctionsStatus.Blocked]: { label: 'Sanctions block', variant: 'red' },
	[SanctionsStatus.Unchecked]: { label: 'Not screened', variant: 'gray' },
} as const satisfies Record<SanctionsStatus, StatusBadge>;

export const ESCROW_FROZEN_BADGE: StatusBadge = {
	label: 'Frozen',
	variant: 'red',
};

interface PayoutReadinessCopy {
	badge: StatusBadge;
	title: string;
	description: string;
}

export const PAYOUT_READINESS = {
	[PayoutReadiness.Ready]: {
		badge: { label: 'Ready', variant: 'green' },
		title: 'Payouts are ready',
		description: 'Claims pay your earnings straight to your payout wallet.',
	},
	[PayoutReadiness.Blocked]: {
		badge: { label: 'Blocked', variant: 'red' },
		title: 'Payouts are blocked',
		description:
			'Sanctions screening blocked the payout wallet. Link another wallet to keep listing machines.',
	},
	[PayoutReadiness.NotSetUp]: {
		badge: { label: 'Not set up', variant: 'amber' },
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
			'New sandboxes cannot start until another funding wallet is linked.',
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

export function shortAddress(address: string): string {
	return `${address.slice(0, ADDRESS_PREFIX_LENGTH)}…${address.slice(-ADDRESS_SUFFIX_LENGTH)}`;
}
