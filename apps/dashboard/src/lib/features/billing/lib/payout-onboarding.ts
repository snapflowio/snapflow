/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	PaymentAccountRequirementsStatus,
	PaymentAccountTransfersStatus,
	type PayoutAccount,
} from '@snapflow/api-client';

export const PAYOUT_SETUP_PARAM = 'setup';

export type PayoutOnboardingStepId = 'account' | 'verify' | 'bank' | 'list';
export type PayoutOnboardingStatus =
	| 'done'
	| 'current'
	| 'action'
	| 'waiting'
	| 'upcoming';

export interface PayoutOnboardingStep {
	id: PayoutOnboardingStepId;
	title: string;
	description: string;
	status: PayoutOnboardingStatus;
}

export const PAYOUT_ONBOARDING_STATUS_LABELS: Record<
	PayoutOnboardingStatus,
	string
> = {
	done: 'Done',
	current: 'Next',
	action: 'Action needed',
	waiting: 'Waiting on Stripe',
	upcoming: 'Not started',
};

const VERIFIED_REQUIREMENTS: ReadonlySet<PaymentAccountRequirementsStatus> =
	new Set([
		PaymentAccountRequirementsStatus.None,
		PaymentAccountRequirementsStatus.EventuallyDue,
	]);

export function isPayoutAccountReady(account: PayoutAccount | null): boolean {
	return account?.payoutsEnabled === true;
}

function verifyStatus(account: PayoutAccount | null): PayoutOnboardingStatus {
	if (!account) return 'upcoming';
	if (VERIFIED_REQUIREMENTS.has(account.requirementsStatus)) return 'done';
	return 'current';
}

function bankStatus(account: PayoutAccount | null): PayoutOnboardingStatus {
	if (!account || verifyStatus(account) !== 'done') return 'upcoming';
	if (isPayoutAccountReady(account)) return 'done';
	if (
		account.payoutsBlockedReason ||
		account.transfersStatus === PaymentAccountTransfersStatus.Restricted
	) {
		return 'action';
	}
	if (account.transfersStatus === PaymentAccountTransfersStatus.Pending) {
		return 'waiting';
	}
	return 'current';
}

export interface PayoutAccountHeadline {
	title: string;
	description: string;
	badge: { label: string; variant: 'green' | 'amber' | 'red' | 'gray' };
}

export function isPayoutAccountVerified(account: PayoutAccount): boolean {
	return verifyStatus(account) === 'done';
}

export function payoutAccountHeadline(
	account: PayoutAccount | null
): PayoutAccountHeadline {
	if (!account) {
		return {
			title: 'Payout account',
			description: 'Get paid weekly for the time customers rent your machines.',
			badge: { label: 'Not set up', variant: 'gray' },
		};
	}
	if (isPayoutAccountReady(account)) {
		return {
			title: 'Payout account',
			description: 'Earnings are paid to your bank every week.',
			badge: { label: 'Active', variant: 'green' },
		};
	}
	if (verifyStatus(account) !== 'done') {
		return {
			title: 'Verify your identity',
			description:
				'Stripe needs a few personal details before it can send you money.',
			badge: { label: 'Details needed', variant: 'amber' },
		};
	}
	if (bankStatus(account) === 'action') {
		return {
			title: 'Payouts paused',
			description:
				account.payoutsBlockedReason ?? 'Stripe needs you to update a detail.',
			badge: { label: 'Action needed', variant: 'red' },
		};
	}
	if (bankStatus(account) === 'waiting') {
		return {
			title: 'Stripe is reviewing your details',
			description: 'This usually takes a few minutes.',
			badge: { label: 'In review', variant: 'amber' },
		};
	}
	return {
		title: 'Add a bank account',
		description: 'Stripe sends your weekly payouts to this account.',
		badge: { label: 'Bank needed', variant: 'amber' },
	};
}

export function payoutOnboardingSteps(
	account: PayoutAccount | null
): PayoutOnboardingStep[] {
	const verify = verifyStatus(account);
	const bank = bankStatus(account);
	return [
		{
			id: 'account',
			title: 'Create a payout account',
			description:
				'Choose your country and whether you get paid as a person or a business.',
			status: account ? 'done' : 'current',
		},
		{
			id: 'verify',
			title: 'Verify your identity with Stripe',
			description:
				'Stripe asks for a few personal details. Snapflow never sees or stores them.',
			status: verify,
		},
		{
			id: 'bank',
			title: 'Add a bank account',
			description:
				account?.payoutsBlockedReason ??
				'Stripe sends your weekly payouts here once transfers are active.',
			status: bank,
		},
		{
			id: 'list',
			title: 'List a machine publicly',
			description:
				'Public listings earn from other organizations. They need a ready payout account.',
			status: isPayoutAccountReady(account) ? 'current' : 'upcoming',
		},
	];
}
