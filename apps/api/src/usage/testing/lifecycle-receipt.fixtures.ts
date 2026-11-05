/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { millisecondsBetween } from '../../common/utils/time.util';
import { MachineUsageRuntimeState } from '../../machine/constants/machine-usage.constants';
import {
	type SignedUsageReceipt,
	signedUsageChain,
} from '../../machine/testing/signed-usage-readings.fixtures';

const READINGS = [
	{
		sampledAt: '2026-10-04T19:27:10.221Z',
		state: MachineUsageRuntimeState.STARTED,
		runningMillis: 8,
	},
	{
		sampledAt: '2026-10-04T19:27:11.292Z',
		state: MachineUsageRuntimeState.STOPPED,
		runningMillis: 805,
	},
	{
		sampledAt: '2026-10-04T19:27:12.766Z',
		state: MachineUsageRuntimeState.STARTED,
		runningMillis: 814,
	},
	{
		sampledAt: '2026-10-04T19:27:13.270Z',
		state: MachineUsageRuntimeState.STARTED,
		runningMillis: 1318,
	},
] as const;

function lifecycleWindow(startAt: string, endAt: string) {
	const window = { startAt: new Date(startAt), endAt: new Date(endAt) };
	return {
		...window,
		durationMillis: millisecondsBetween(
			window.startAt,
			window.endAt
		).toString(),
	};
}

export const LIFECYCLE_WINDOWS = {
	firstRun: lifecycleWindow(
		'2026-10-04T19:27:10.346Z',
		'2026-10-04T19:27:10.968Z'
	),
	secondRun: lifecycleWindow(
		'2026-10-04T19:27:12.947Z',
		'2026-10-04T19:27:13.145Z'
	),
};

export function lifecycleReceipts(): SignedUsageReceipt[] {
	return signedUsageChain(
		READINGS.map((reading) => ({
			...reading,
			sampledAt: new Date(reading.sampledAt),
		}))
	);
}
