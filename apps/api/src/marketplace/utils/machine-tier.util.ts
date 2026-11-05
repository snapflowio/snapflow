/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MACHINE_TIER_ORDER } from '../constants/marketplace.constants';
import type { MachineTier } from '../enums/machine-tier.enum';

export function tiersAtLeast(minimum: MachineTier): MachineTier[] {
	return MACHINE_TIER_ORDER.slice(MACHINE_TIER_ORDER.indexOf(minimum));
}
