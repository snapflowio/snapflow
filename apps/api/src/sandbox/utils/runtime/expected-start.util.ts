/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxState } from '../../enums/sandbox-state.enum';

const EXPECTED_START = {
	STOPPED_SECONDS: 1,
	ARCHIVED_BASE_SECONDS: 5,
	ARCHIVED_SECONDS_PER_GIB: 10,
} as const;

export function expectedStartSeconds(
	state: SandboxState,
	diskGiB: number
): number | null {
	switch (state) {
		case SandboxState.STOPPED:
			return EXPECTED_START.STOPPED_SECONDS;
		case SandboxState.ARCHIVED:
			return (
				EXPECTED_START.ARCHIVED_BASE_SECONDS +
				Math.ceil(diskGiB * EXPECTED_START.ARCHIVED_SECONDS_PER_GIB)
			);
		default:
			return null;
	}
}
