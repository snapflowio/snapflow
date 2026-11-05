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
	| 'exposureCeilingProbationaryCents'
	| 'exposureCeilingEstablishedCents'
	| 'exposureCeilingHostCents';

export type ConsistencySettings = Pick<Settings, OrderedSettingKey>;

const ORDERED_SETTINGS: readonly (readonly [
	OrderedSettingKey,
	OrderedSettingKey,
])[] = [
	['exposureCeilingProbationaryCents', 'exposureCeilingEstablishedCents'],
	['exposureCeilingEstablishedCents', 'exposureCeilingHostCents'],
];

export function settingsInconsistency(
	settings: ConsistencySettings
): string | null {
	for (const [lower, upper] of ORDERED_SETTINGS) {
		if (settings[upper] < settings[lower]) {
			return `${upper} must be at least ${lower}`;
		}
	}
	return null;
}
