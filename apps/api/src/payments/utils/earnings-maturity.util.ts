/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { addDays } from '../../common/utils/time.util';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import type { SettingsSnapshot } from '../../settings/types/settings.types';

export type PayoutHoldSettings = Pick<
	SettingsSnapshot,
	| 'payoutHoldCommunityDays'
	| 'payoutHoldVerifiedDays'
	| 'payoutHoldDatacenterDays'
>;

export interface MaturityInput {
	reconciledAt: Date;
	holdDays: number;
	newFundingUntil: Date | null;
}

export function payoutHoldDays(
	tier: MachineTier,
	settings: PayoutHoldSettings
): number {
	switch (tier) {
		case MachineTier.DATACENTER:
			return settings.payoutHoldDatacenterDays;
		case MachineTier.VERIFIED:
			return settings.payoutHoldVerifiedDays;
		case MachineTier.COMMUNITY:
		case MachineTier.PRIVATE:
			return settings.payoutHoldCommunityDays;
	}
}

export function newFundingUntil(
	firstChargedAt: readonly Date[],
	newFundingHoldDays: number
): Date | null {
	if (firstChargedAt.length === 0) return null;
	const latest = Math.max(...firstChargedAt.map((date) => date.getTime()));
	return addDays(new Date(latest), newFundingHoldDays);
}

export function earningsMaturesAt(input: MaturityInput): Date {
	const held = addDays(input.reconciledAt, input.holdDays);
	const funding = input.newFundingUntil;
	if (funding && input.reconciledAt < funding && funding > held) {
		return funding;
	}
	return held;
}
