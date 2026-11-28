/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MACHINE_QUALIFICATION_REASON } from '../../machine/constants/machine-qualification.constants';
import type { MachineState } from '../../machine/enums/machine-state.enum';
import {
	MACHINE_NOTICE_KIND,
	type NoticedMachineState,
} from '../constants/notice.constants';

const TRANSIENT_MACHINE_CHECK_FAILURES: ReadonlySet<string> = new Set([
	MACHINE_QUALIFICATION_REASON.EXPIRED,
	MACHINE_QUALIFICATION_REASON.WRONG_SESSION,
]);

export function isNoticedMachineState(
	state: MachineState
): state is NoticedMachineState {
	return Object.hasOwn(MACHINE_NOTICE_KIND, state);
}

export function noticedMachineCheckFailures(
	failures: readonly string[]
): string[] {
	return [...new Set(failures)]
		.filter((failure) => !TRANSIENT_MACHINE_CHECK_FAILURES.has(failure))
		.sort();
}
