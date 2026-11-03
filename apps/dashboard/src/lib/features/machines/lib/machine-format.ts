/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Machine } from '@snapflow/api-client';

const PERCENT_FRACTION_DIGITS = 1;
const UNAVAILABLE_PERCENT = 'N/A';

export const MACHINE_SERVICE_STATE = {
	awaitingReport: 'awaiting report',
	healthy: 'healthy',
	unhealthy: 'unhealthy',
} as const;

export function formatPercent(value: number | undefined): string {
	return value === undefined
		? UNAVAILABLE_PERCENT
		: `${value.toFixed(PERCENT_FRACTION_DIGITS)}%`;
}

export function machineServiceState(
	machine: Pick<Machine, 'serviceHealth'>
): string {
	if (!machine.serviceHealth || machine.serviceHealth.length === 0) {
		return MACHINE_SERVICE_STATE.awaitingReport;
	}
	return machine.serviceHealth.every((service) => service.healthy)
		? MACHINE_SERVICE_STATE.healthy
		: MACHINE_SERVICE_STATE.unhealthy;
}

export function machineSchedulingLabel(machine: Machine): string {
	return machine.unschedulable ? 'Paused' : 'Available';
}

export function machineSchedulingActionLabel(machine: Machine): string {
	return machine.unschedulable ? 'Enable scheduling' : 'Pause scheduling';
}

export function machineDrainingMessage(draining: boolean): string {
	return draining
		? 'Machine decommissioning started'
		: 'Machine decommissioning canceled';
}

export function machineDrainingActionLabel(machine: Machine): string {
	return machine.draining ? 'Cancel decommissioning' : 'Start decommissioning';
}
