/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SettingsSnapshot } from '../../settings/types/settings.types';
import { MachineTier } from '../enums/machine-tier.enum';
import { tiersAtLeast } from './machine-tier.util';

export type MarkupSettings = Pick<
	SettingsSnapshot,
	'standardMarkupBasisPoints' | 'verifiedMarkupBasisPoints'
>;

const VERIFIED_MARKUP_TIERS: ReadonlySet<MachineTier> = new Set(
	tiersAtLeast(MachineTier.VERIFIED)
);

// The markup a customer pays on top of another organization's machine:
// Verified and Datacenter machines carry the verified rate, every other tier
// the standard one. A customer's own machines carry none, which callers
// decide before pricing a machine at all.
export function marketMarkupBasisPoints(
	settings: MarkupSettings,
	tier: MachineTier
): number {
	return VERIFIED_MARKUP_TIERS.has(tier)
		? settings.verifiedMarkupBasisPoints
		: settings.standardMarkupBasisPoints;
}
