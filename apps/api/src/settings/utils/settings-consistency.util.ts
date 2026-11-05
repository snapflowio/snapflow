/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import type { Settings } from '../entities/settings.entity';

type OrderedSettingKey =
	| 'exposureCeilingProbationaryCents'
	| 'exposureCeilingEstablishedCents'
	| 'exposureCeilingHostCents';

type VoucherSettingKey =
	| 'voucherIntervalSeconds'
	| 'voucherGraceIntervals'
	| 'voucherLifetimeHours'
	| 'claimIntervalMinutes';

export type ConsistencySettings = Pick<
	Settings,
	OrderedSettingKey | VoucherSettingKey
>;

const ORDERED_SETTINGS: readonly (readonly [
	OrderedSettingKey,
	OrderedSettingKey,
])[] = [
	['exposureCeilingProbationaryCents', 'exposureCeilingEstablishedCents'],
	['exposureCeilingEstablishedCents', 'exposureCeilingHostCents'],
];

// Vouchers are reissued once half their lifetime has passed, so a voucher a
// host holds is always claimable for at least that long. A lapse must be
// noticed and a claim relayed within it, or vouchers would expire unclaimed.
const VOUCHER_LIFETIME_SHARE_DIVISOR = 2;

const VOUCHER_WINDOWS: readonly {
	name: string;
	seconds: (settings: ConsistencySettings) => number;
}[] = [
	{
		name: 'voucherIntervalSeconds * voucherGraceIntervals',
		seconds: (settings) =>
			settings.voucherIntervalSeconds * settings.voucherGraceIntervals,
	},
	{
		name: 'claimIntervalMinutes',
		seconds: (settings) => settings.claimIntervalMinutes * SECONDS_PER_MINUTE,
	},
];

export function settingsInconsistency(
	settings: ConsistencySettings
): string | null {
	for (const [lower, upper] of ORDERED_SETTINGS) {
		if (settings[upper] < settings[lower]) {
			return `${upper} must be at least ${lower}`;
		}
	}
	const halfLifetimeSeconds =
		(settings.voucherLifetimeHours * SECONDS_PER_HOUR) /
		VOUCHER_LIFETIME_SHARE_DIVISOR;
	for (const window of VOUCHER_WINDOWS) {
		if (window.seconds(settings) > halfLifetimeSeconds) {
			return `${window.name} must be at most half of voucherLifetimeHours`;
		}
	}
	return null;
}
