/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type Stripe from 'stripe';
import {
	StripeAccountConfiguration,
	StripeTransfersCapabilityStatus,
} from '../constants/stripe.constants';
import {
	PaymentAccountRequirementsStatus,
	PaymentAccountTaxInformationStatus,
	PaymentAccountTransfersStatus,
} from '../enums/payment-account-status.enum';

export interface PaymentAccountState {
	country: string | null;
	customerConfigured: boolean;
	recipientRequested: boolean;
	transfersStatus: PaymentAccountTransfersStatus;
	requirementsStatus: PaymentAccountRequirementsStatus;
	taxInformationStatus: PaymentAccountTaxInformationStatus;
	closed: boolean;
}

const REQUIREMENTS_STATUS: Readonly<
	Record<string, PaymentAccountRequirementsStatus>
> = {
	eventually_due: PaymentAccountRequirementsStatus.EVENTUALLY_DUE,
	currently_due: PaymentAccountRequirementsStatus.CURRENTLY_DUE,
	past_due: PaymentAccountRequirementsStatus.PAST_DUE,
};

function transfersStatus(
	account: Stripe.V2.Core.Account
): PaymentAccountTransfersStatus {
	const status =
		account.configuration?.recipient?.capabilities?.stripe_balance
			?.stripe_transfers?.status;
	switch (status) {
		case StripeTransfersCapabilityStatus.ACTIVE:
			return PaymentAccountTransfersStatus.ACTIVE;
		case StripeTransfersCapabilityStatus.PENDING:
			return PaymentAccountTransfersStatus.PENDING;
		case StripeTransfersCapabilityStatus.RESTRICTED:
			return PaymentAccountTransfersStatus.RESTRICTED;
		default:
			return PaymentAccountTransfersStatus.INACTIVE;
	}
}

function taxInformationStatus(
	account: Stripe.V2.Core.Account
): PaymentAccountTaxInformationStatus {
	const identity = account.identity;
	const numbers = [
		...(identity?.business_details?.id_numbers ?? []),
		...(identity?.individual?.id_numbers ?? []),
	];
	return numbers.length > 0
		? PaymentAccountTaxInformationStatus.PROVIDED
		: PaymentAccountTaxInformationStatus.MISSING;
}

export function balanceSettingsMatch(
	current: Stripe.BalanceSettings,
	desired: Stripe.BalanceSettingsUpdateParams
): boolean {
	const schedule = current.payments.payouts?.schedule;
	const wanted = desired.payments?.payouts?.schedule;
	const days = new Set(schedule?.weekly_payout_days ?? []);
	const wantedDays = wanted?.weekly_payout_days ?? [];
	return (
		current.payments.debit_negative_balances ===
			desired.payments?.debit_negative_balances &&
		schedule?.interval === wanted?.interval &&
		days.size === wantedDays.length &&
		wantedDays.every((day) => days.has(day))
	);
}

export function paymentAccountState(
	account: Stripe.V2.Core.Account
): PaymentAccountState {
	const deadline = account.requirements?.summary?.minimum_deadline?.status;
	return {
		country: account.identity?.country?.toUpperCase() ?? null,
		customerConfigured: account.applied_configurations.includes(
			StripeAccountConfiguration.CUSTOMER
		),
		recipientRequested: account.applied_configurations.includes(
			StripeAccountConfiguration.RECIPIENT
		),
		transfersStatus: transfersStatus(account),
		requirementsStatus: deadline
			? (REQUIREMENTS_STATUS[deadline] ?? PaymentAccountRequirementsStatus.NONE)
			: PaymentAccountRequirementsStatus.NONE,
		taxInformationStatus: taxInformationStatus(account),
		closed: account.closed === true,
	};
}
