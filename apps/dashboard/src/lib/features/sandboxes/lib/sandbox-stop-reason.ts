/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type Sandbox,
	SandboxDesiredState,
	SandboxState,
} from '@snapflow/api-client';

type StopReasonView = Pick<
	Sandbox,
	'state' | 'desiredState' | 'errorReason' | 'stopReason' | 'preemptedAt'
>;

export interface UnexpectedStop {
	title: string;
	reason: string;
	guidance: string;
}

const RESTARTING_TITLE = 'Restarting after an unexpected stop';
const RESTARTING_GUIDANCE =
	'Snapflow starts it again from its disk with increasing delays. Stop it to cancel the restart.';
const PREEMPTED = {
	title: 'Preempted for an on-demand sandbox',
	reason: 'Its machine needed the capacity for an on-demand sandbox.',
	guidance:
		'Interruptible sandboxes are stopped and archived when their capacity is needed. Start it to run again on any machine with idle capacity.',
} as const;
const STOPPED_TITLE = 'Stopped unexpectedly';
const STOPPED_GUIDANCE =
	'Its disk is intact; memory from before the stop was not kept. Start it to boot again from its disk.';

export function sandboxStateReason(
	sandbox: StopReasonView
): string | undefined {
	return sandbox.errorReason ?? sandbox.stopReason;
}

export function sandboxUnexpectedStop(
	sandbox: StopReasonView
): UnexpectedStop | null {
	if (sandbox.preemptedAt && !sandbox.errorReason) return PREEMPTED;
	if (!sandbox.stopReason || sandbox.errorReason) return null;
	const restarting =
		sandbox.desiredState === SandboxDesiredState.Started &&
		sandbox.state !== SandboxState.Started;
	return {
		title: restarting ? RESTARTING_TITLE : STOPPED_TITLE,
		reason: sandbox.stopReason,
		guidance: restarting ? RESTARTING_GUIDANCE : STOPPED_GUIDANCE,
	};
}
