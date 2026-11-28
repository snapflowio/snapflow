/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type Machine,
	MachineUpdatePhase,
	type MachineUpdateStatusDto,
} from '@snapflow/api-client';
import { joinFacts } from '#lib/features/earnings/lib/earnings-copy.ts';

const UNKNOWN_VERSION = 'Unknown version';
const LINE_BREAK = /\r?\n/;

const PHASE_LABELS = {
	[MachineUpdatePhase.Idle]: 'Up to date',
	[MachineUpdatePhase.Ready]: 'Up to date',
	[MachineUpdatePhase.Staged]: 'Update staged',
	[MachineUpdatePhase.Draining]: 'Updating',
	[MachineUpdatePhase.Activating]: 'Updating',
	[MachineUpdatePhase.Failed]: 'Update failed',
} as const satisfies Record<MachineUpdatePhase, string>;

export function releaseSummary(machine: Machine): string {
	const status = machine.updateStatus;
	return joinFacts([
		machine.appVersion ?? UNKNOWN_VERSION,
		status?.channel,
		status ? PHASE_LABELS[status.phase] : null,
	]);
}

export function releaseDetails(status: MachineUpdateStatusDto): string {
	return joinFacts([
		status.candidate ? `Staged ${status.candidate.version}` : null,
		status.previous ? `Previous ${status.previous.version}` : null,
		`Window ${status.maintenanceWindow}`,
	]);
}

export function updateFailureLines(
	status: MachineUpdateStatusDto | undefined
): string[] {
	return status?.lastFailure ? status.lastFailure.split(LINE_BREAK) : [];
}
