/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Settings } from '../entities/settings.entity';

type OrderedSettingKey =
	| 'topUpMinimumCents'
	| 'topUpMaximumCents'
	| 'autoTopUpMinimumCents'
	| 'exposureCeilingProbationaryCents'
	| 'exposureCeilingEstablishedCents'
	| 'exposureCeilingHostCents'
	| 'payoutHoldDatacenterDays'
	| 'payoutHoldVerifiedDays'
	| 'payoutHoldCommunityDays';

export type ConsistencySettings = Pick<
	Settings,
	OrderedSettingKey | 'topUpPresetsCents'
>;

const ORDERED_SETTINGS: readonly (readonly [
	OrderedSettingKey,
	OrderedSettingKey,
])[] = [
	['topUpMinimumCents', 'topUpMaximumCents'],
	['topUpMinimumCents', 'autoTopUpMinimumCents'],
	['autoTopUpMinimumCents', 'topUpMaximumCents'],
	['exposureCeilingProbationaryCents', 'exposureCeilingEstablishedCents'],
	['exposureCeilingEstablishedCents', 'exposureCeilingHostCents'],
	['payoutHoldDatacenterDays', 'payoutHoldVerifiedDays'],
	['payoutHoldVerifiedDays', 'payoutHoldCommunityDays'],
];

export function settingsInconsistency(
	settings: ConsistencySettings
): string | null {
	for (const [lower, upper] of ORDERED_SETTINGS) {
		if (settings[upper] < settings[lower]) {
			return `${upper} must be at least ${lower}`;
		}
	}
	const outOfRange = settings.topUpPresetsCents.find(
		(preset) =>
			preset < settings.topUpMinimumCents || preset > settings.topUpMaximumCents
	);
	if (outOfRange !== undefined) {
		return `Top-up preset ${outOfRange} must be between topUpMinimumCents and topUpMaximumCents`;
	}
	return null;
}
