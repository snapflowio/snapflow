/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../common/values/micro-usd.value';
import { BillingRestriction } from '../enums/billing-restriction.enum';
import { FUNDING_POLICY } from './funding.constants';

export const BillingAdmissionErrorCode = {
	MACHINE_HOST_NOT_FOUND: 'machine_host_not_found',
	MACHINE_NOT_FOUND: 'machine_not_found',
	MACHINE_TRUST_RESTRICTED: 'machine_trust_restricted',
	BILLING_AUTHORIZATION_REQUIRED: 'billing_authorization_required',
	MACHINE_EXPOSURE_LIMITED: 'machine_exposure_limited',
	HOST_EXPOSURE_LIMITED: 'host_exposure_limited',
} as const;

export type BillingAdmissionErrorCode =
	(typeof BillingAdmissionErrorCode)[keyof typeof BillingAdmissionErrorCode];

export const BILLING_RESTRICTION_MESSAGES: Readonly<
	Record<BillingRestriction, string>
> = {
	[BillingRestriction.INSUFFICIENT_CREDIT]:
		'Insufficient escrow balance: it must cover one hour of everything that would then run. Add funds on the Funding page, then try again.',
	[BillingRestriction.MONTHLY_BUDGET_EXHAUSTED]:
		"The organization's monthly budget is used up. Raise the budget on the Billing page, or wait for the next billing period.",
	[BillingRestriction.API_KEY_BUDGET_EXHAUSTED]: `This API key reached its ${FUNDING_POLICY.apiKeyBudgetWindowDays}-day compute spending limit. Raise the limit on the API keys page, or use another key.`,
	[BillingRestriction.API_KEY_BUDGET_WOULD_BE_EXCEEDED]: `Starting this sandbox would take this API key past its ${FUNDING_POLICY.apiKeyBudgetWindowDays}-day compute spending limit. Raise the limit on the API keys page, stop some of the key's running sandboxes, or use another key.`,
	[BillingRestriction.API_KEY_CONCURRENCY_EXHAUSTED]:
		"This API key already runs as many sandboxes as its budget allows. Stop one of its sandboxes, or raise the key's limit on the API keys page.",
};

export const API_KEY_BUDGET_MESSAGES = {
	exhausted: (spent: MicroUsd, limit: MicroUsd): string =>
		`This API key spent $${spent.toUsd()} of its $${limit.toUsd()} ${FUNDING_POLICY.apiKeyBudgetWindowDays}-day compute spending limit, so it cannot start sandboxes. Raise the limit on the API keys page, or use another key.`,
	wouldBeExceeded: (
		remaining: MicroUsd,
		projected: MicroUsd,
		horizonMinutes: number
	): string =>
		`This API key has $${remaining.toUsd()} left of its ${FUNDING_POLICY.apiKeyBudgetWindowDays}-day compute spending limit, but its running sandboxes and this one would cost $${projected.toUsd()} over the next ${horizonMinutes} minutes. Raise the limit on the API keys page, stop some of the key's running sandboxes, or use another key.`,
} as const;

export const BillingBudgetErrorCode = {
	IF_MATCH_REQUIRED: 'billing_budget_if_match_required',
	VERSION_CONFLICT: 'billing_budget_version_conflict',
	ORGANIZATION_NOT_FOUND: 'organization_not_found',
} as const;

export const HostExposureScope = {
	MACHINE: 'machine',
	HOST: 'host',
} as const;

export type HostExposureScope =
	(typeof HostExposureScope)[keyof typeof HostExposureScope];

export const PLACEMENT_AUTHORIZATION_CREATED_BY = 'system:scheduler';

export const MINIMUM_BILLABLE_HOURLY_MICRO_USD = MicroUsd.of(1n);
