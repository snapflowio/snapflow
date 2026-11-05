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
		'Insufficient credit to run this sandbox; add credit and try again',
	[BillingRestriction.MONTHLY_BUDGET_EXHAUSTED]:
		'Monthly budget exhausted; raise the budget or wait for the next period',
	[BillingRestriction.NETWORK_BUDGET_EXHAUSTED]:
		'Network budget exhausted; raise the budget or wait for the next period',
};

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
