/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResourceShapeFields } from '../../../common/values/resource-shape.value';
import {
	SANDBOX_STATES_CONDITIONALLY_CONSUMING_COMPUTE,
	SANDBOX_STATES_CONSUMING_COMPUTE,
} from '../../../organization/tenant/constants/sandbox-states-consuming-compute.constants';
import { SANDBOX_STATES_CONSUMING_DISK } from '../../../organization/tenant/constants/sandbox-states-consuming-disk.constants';
import { SandboxDesiredState } from '../../../sandbox/instance/enums/sandbox-desired-state.enum';
import { SANDBOX_STATES_CONVERGING } from '../../../sandbox/machine/constants/machine-placement.constants';
import { MachineState } from '../../../sandbox/machine/enums/machine-state.enum';

const COMPUTE_USAGE_SQL = `sandbox_usage.state = ANY(ARRAY[?]::sandbox_state_enum[]) OR (sandbox_usage.state = ANY(ARRAY[?]::sandbox_state_enum[]) AND sandbox_usage."desiredState" = ?)`;
const COMPUTE_USAGE_BINDINGS = [
	SANDBOX_STATES_CONSUMING_COMPUTE,
	SANDBOX_STATES_CONDITIONALLY_CONSUMING_COMPUTE,
	SandboxDesiredState.STARTED,
];

export const MACHINE_LOAD_SQL = `SELECT
		COALESCE(SUM(sandbox_usage.cpu) FILTER (WHERE ${COMPUTE_USAGE_SQL}), 0) AS cpu,
		COALESCE(SUM(sandbox_usage.mem) FILTER (WHERE ${COMPUTE_USAGE_SQL}), 0) AS memory,
		COALESCE(SUM(sandbox_usage.disk) FILTER (WHERE sandbox_usage.state = ANY(ARRAY[?]::sandbox_state_enum[])), 0) AS disk,
		COALESCE(SUM(sandbox_usage.gpu) FILTER (WHERE ${COMPUTE_USAGE_SQL}), 0) AS gpu,
		COUNT(*) FILTER (WHERE sandbox_usage.state = ANY(ARRAY[?]::sandbox_state_enum[])) AS converging
	FROM sandbox sandbox_usage WHERE sandbox_usage."machineId" = machine.id`;

export const MACHINE_LOAD_BINDINGS = [
	...COMPUTE_USAGE_BINDINGS,
	...COMPUTE_USAGE_BINDINGS,
	SANDBOX_STATES_CONSUMING_DISK,
	...COMPUTE_USAGE_BINDINGS,
	SANDBOX_STATES_CONVERGING,
];

const CAPACITY_CPU_SQL =
	'LEAST(machine.cpu, COALESCE(machine."measuredVcpu", machine.cpu))';
const CAPACITY_MEMORY_SQL =
	'LEAST(machine."memoryGiB", COALESCE(machine."measuredMemoryGib", machine."memoryGiB"))';
const CAPACITY_DISK_SQL =
	'LEAST(machine."diskGiB", COALESCE(machine."measuredDiskGib", machine."diskGiB"))';
const PERCENT = 100;

function committedSql(
	reserved: string,
	usagePercentage: string,
	allocated: string,
	capacity: string
): string {
	return `GREATEST(${reserved}, ${usagePercentage} / ${PERCENT}.0 * ${capacity} + GREATEST(0, ${reserved} - ${allocated}))`;
}

const FIT_SQL = `EXISTS (SELECT 1 FROM (${MACHINE_LOAD_SQL}) fit_load
	WHERE fit_load.cpu + ? <= ${CAPACITY_CPU_SQL}
		AND ${committedSql('fit_load.memory', 'machine."currentMemoryUsagePercentage"', 'machine."currentAllocatedMemoryGiB"', CAPACITY_MEMORY_SQL)} + ? <= ${CAPACITY_MEMORY_SQL}
		AND ${committedSql('fit_load.disk', 'machine."currentDiskUsagePercentage"', 'machine."currentAllocatedDiskGiB"', CAPACITY_DISK_SQL)} + ? <= ${CAPACITY_DISK_SQL}
		AND fit_load.gpu + ? <= machine."gpuCount")`;

export interface SqlFragment {
	sql: string;
	bindings: unknown[];
}

export function hostGateSql(): SqlFragment {
	return {
		sql: `machine.state = ? AND machine.unschedulable = false AND machine.draining = false
			AND machine."sessionExpiresAt" > transaction_timestamp()`,
		bindings: [MachineState.READY],
	};
}

export function workloadGateSql(shape: ResourceShapeFields): SqlFragment {
	return {
		sql: FIT_SQL,
		bindings: [
			...MACHINE_LOAD_BINDINGS,
			shape.cpu,
			shape.memoryGiB,
			shape.diskGiB,
			shape.gpu,
		],
	};
}
