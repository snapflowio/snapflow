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
	MachineState,
	type MachineTrustDto,
	MachineUpdatePhase,
} from '@snapflow/api-client';
import { formatRelativeTime } from '#lib/components/resource/table/time-cell.ts';
import type { NoticeTone } from '#lib/components/ui/notice.svelte';
import { pluralize, sentenceCase } from '#lib/utils/text.ts';
import { failedDiagnostics } from './machine-health.ts';

export const MachineAttentionKind = {
	Offline: 'offline',
	Qualification: 'qualification',
	PaymentHold: 'payment-hold',
	Decommissioning: 'decommissioning',
	Update: 'update',
} as const;

export type MachineAttentionKind =
	(typeof MachineAttentionKind)[keyof typeof MachineAttentionKind];

export interface MachineAttention {
	kind: MachineAttentionKind;
	tone: NoticeTone;
	title: string;
	info?: string;
}

const OFFLINE_STATES: ReadonlySet<MachineState> = new Set([
	MachineState.Unresponsive,
	MachineState.Disabled,
]);
const NEVER_CHECKED = 'It has not checked in yet.';

function offline(machine: Machine): MachineAttention | null {
	if (!OFFLINE_STATES.has(machine.state)) return null;
	return {
		kind: MachineAttentionKind.Offline,
		tone: 'error',
		title: 'Machine is offline',
		info: machine.lastChecked
			? `Last checked ${formatRelativeTime(machine.lastChecked).toLowerCase()}.`
			: NEVER_CHECKED,
	};
}

function qualification(
	machine: Machine,
	trust: MachineTrustDto | undefined
): MachineAttention | null {
	const failedChecks = failedDiagnostics(machine.diagnostics?.checks ?? []);
	if (machine.state === MachineState.Failed || failedChecks > 0) {
		return {
			kind: MachineAttentionKind.Qualification,
			tone: 'warning',
			title:
				failedChecks > 0
					? `${pluralize(failedChecks, 'readiness check')} failing`
					: 'Readiness checks failing',
			info: machine.readinessReason,
		};
	}
	if (trust?.restrictionReason) {
		return {
			kind: MachineAttentionKind.Qualification,
			tone: 'warning',
			title: 'Placement is restricted',
			info: sentenceCase(trust.restrictionReason),
		};
	}
	return null;
}

function paymentHold(machine: Machine): MachineAttention | null {
	const holds = machine.paymentHolds?.holds.length ?? 0;
	if (holds === 0) return null;
	return {
		kind: MachineAttentionKind.PaymentHold,
		tone: 'warning',
		title: `${pluralize(holds, 'sandbox', 'sandboxes')} on payment hold`,
		info: 'They resume once their renters pay.',
	};
}

function decommissioning(machine: Machine): MachineAttention | null {
	if (!machine.draining) return null;
	return {
		kind: MachineAttentionKind.Decommissioning,
		tone: 'info',
		title: 'Decommissioning',
		info: 'No new sandboxes are placed here, and running ones move off.',
	};
}

function update(machine: Machine): MachineAttention | null {
	const status = machine.updateStatus;
	if (status?.phase !== MachineUpdatePhase.Staged || !status.candidate) {
		return null;
	}
	return {
		kind: MachineAttentionKind.Update,
		tone: 'info',
		title: `Update ${status.candidate.version} is staged`,
		info: `It installs in the maintenance window, ${status.maintenanceWindow}.`,
	};
}

export function machineAttention(
	machine: Machine,
	trust?: MachineTrustDto
): MachineAttention | null {
	return (
		offline(machine) ??
		qualification(machine, trust) ??
		paymentHold(machine) ??
		decommissioning(machine) ??
		update(machine)
	);
}

export function machineNeedsAttention(machine: Machine): boolean {
	const attention = machineAttention(machine);
	return attention !== null && attention.tone !== 'info';
}

export function machineOnline(machine: Machine): boolean {
	return (
		!OFFLINE_STATES.has(machine.state) &&
		machine.state !== MachineState.Decommissioned
	);
}
