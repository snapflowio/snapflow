/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../common/values/micro-usd.value';

export const LeaseRenewalDecision = {
	RENEW: 'renew',
	CONSENT_REQUIRED: 'consent_required',
} as const;

export type LeaseRenewalDecision =
	(typeof LeaseRenewalDecision)[keyof typeof LeaseRenewalDecision];

export interface LeaseRenewalPrices {
	hourlyGrossMicroUsd: MicroUsd;
	egressGrossMicroUsdPerGiB: MicroUsd;
}

export interface LeaseRenewalInput {
	selfUse: boolean;
	lease: LeaseRenewalPrices;
	current: LeaseRenewalPrices | null;
	maxHourlyPriceMicroUsd: MicroUsd | null;
	maxEgressMicroUsdPerGiB: MicroUsd | null;
}

function consented(
	current: MicroUsd,
	locked: MicroUsd,
	maximum: MicroUsd | null
): boolean {
	return (
		current.atMost(locked) || (maximum !== null && current.atMost(maximum))
	);
}

export function leaseRenewalDecision(
	input: LeaseRenewalInput
): LeaseRenewalDecision {
	if (input.selfUse) return LeaseRenewalDecision.RENEW;
	const { current, lease } = input;
	if (current === null) return LeaseRenewalDecision.CONSENT_REQUIRED;
	return consented(
		current.hourlyGrossMicroUsd,
		lease.hourlyGrossMicroUsd,
		input.maxHourlyPriceMicroUsd
	) &&
		consented(
			current.egressGrossMicroUsdPerGiB,
			lease.egressGrossMicroUsdPerGiB,
			input.maxEgressMicroUsdPerGiB
		)
		? LeaseRenewalDecision.RENEW
		: LeaseRenewalDecision.CONSENT_REQUIRED;
}
