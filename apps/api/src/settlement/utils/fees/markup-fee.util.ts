/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BPS_DENOMINATOR } from '@snapflow/contracts';

export function maximumMarkupForFee(feeBps: number): number {
	const next = feeBps + 1;
	return Math.ceil((next * BPS_DENOMINATOR) / (BPS_DENOMINATOR - next)) - 1;
}
