/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';
import type { EarningsView } from './earnings-params.ts';

const VIEW_PARAM = 'view';
const MACHINE_PARAM = 'machine';

export function earningsViewHref(
	view: EarningsView,
	machineId?: string
): string {
	const search = new URLSearchParams({ [VIEW_PARAM]: view });
	if (machineId) search.set(MACHINE_PARAM, machineId);
	return `${resolve(Path.EARNINGS)}?${search}`;
}
