/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResourceShapeFields } from '../../common/values/resource-shape.value';
import { SANDBOX_STATES_CONVERGING } from '../../machine/constants/machine-placement.constants';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { MEBIBYTES_PER_GIBIBYTE } from '../../machine/utils/machine-memory.util';
import { SandboxDesiredState } from '../../sandbox/enums/sandbox-desired-state.enum';
import { CAPACITY_HOLD } from '../../sandbox/values/sandbox-hold-policy.value';

const SANDBOX_USAGE_ALIAS = 'sandbox_usage';
const COMPUTE_HOLD = CAPACITY_HOLD.computeSql(SANDBOX_USAGE_ALIAS);
const DISK_HOLD = CAPACITY_HOLD.diskSql(SANDBOX_USAGE_ALIAS);

const COMPUTE_USAGE_SQL = `(${COMPUTE_HOLD.sql} OR (${SANDBOX_USAGE_ALIAS}."pausedForPayment" AND ${SANDBOX_USAGE_ALIAS}."desiredState" <> ?))`;
const COMPUTE_USAGE_BINDINGS = [
	...COMPUTE_HOLD.bindings,
	SandboxDesiredState.DESTROYED,
];

export interface SqlFragment {
	sql: string;
	bindings: unknown[];
}

const ALL_COMPUTE: SqlFragment = { sql: 'TRUE', bindings: [] };

const ON_DEMAND_COMPUTE: SqlFragment = {
	sql: `NOT ${SANDBOX_USAGE_ALIAS}."placementInterruptible"`,
	bindings: [],
};

export function countedCompute(interruptible: boolean): SqlFragment {
	return interruptible ? ALL_COMPUTE : ON_DEMAND_COMPUTE;
}

export function computeExcluding(sandboxIds: readonly string[]): SqlFragment {
	return {
		sql: `NOT (${SANDBOX_USAGE_ALIAS}.id = ANY(ARRAY[?]::varchar[]) OR ${SANDBOX_USAGE_ALIAS}."preemptedAt" IS NOT NULL)`,
		bindings: [sandboxIds],
	};
}

function memoryFootprintSql(guestGiB: string): string {
	return `(${guestGiB} * ${MEBIBYTES_PER_GIBIBYTE} + machine."vmMemoryOverheadMiB")`;
}

function cpuFootprintSql(vcpus: string): string {
	return `(CEIL(${vcpus}::numeric / machine."vcpuGranularity") * machine."vcpuGranularity")`;
}

function machineLoad(compute: SqlFragment): SqlFragment {
	const counted = `${COMPUTE_USAGE_SQL} AND ${compute.sql}`;
	const released = `${COMPUTE_USAGE_SQL} AND NOT (${compute.sql})`;
	const countedBindings = [...COMPUTE_USAGE_BINDINGS, ...compute.bindings];
	return {
		sql: `SELECT
		COALESCE(SUM(${cpuFootprintSql('sandbox_usage.cpu')}) FILTER (WHERE ${counted}), 0) AS cpu,
		COALESCE(SUM(${memoryFootprintSql('sandbox_usage.mem')}) FILTER (WHERE ${counted}), 0) AS memory,
		COALESCE(SUM(${memoryFootprintSql('sandbox_usage.mem')}) FILTER (WHERE ${released}), 0) AS released_memory,
		COALESCE(SUM(sandbox_usage.disk) FILTER (WHERE ${DISK_HOLD.sql}), 0) AS disk,
		COALESCE(SUM(sandbox_usage.gpu) FILTER (WHERE ${counted}), 0) AS gpu,
		COUNT(*) FILTER (WHERE sandbox_usage.state = ANY(ARRAY[?]::sandbox_state_enum[])) AS converging
	FROM sandbox sandbox_usage WHERE sandbox_usage."machineId" = machine.id`,
		bindings: [
			...countedBindings,
			...countedBindings,
			...countedBindings,
			...DISK_HOLD.bindings,
			...countedBindings,
			SANDBOX_STATES_CONVERGING,
		],
	};
}

const MACHINE_LOAD = machineLoad(ALL_COMPUTE);

export const MACHINE_LOAD_SQL = MACHINE_LOAD.sql;

export const MACHINE_LOAD_BINDINGS = MACHINE_LOAD.bindings;

export const CAPACITY_CPU_SQL =
	'LEAST(machine.cpu, COALESCE(machine."measuredVcpu", machine.cpu))';
const CAPACITY_MEMORY_SQL = `LEAST(machine."allocatableMemoryMiB", COALESCE(${memoryFootprintSql('machine."measuredMemoryGib"')}, machine."allocatableMemoryMiB"))`;
const CAPACITY_DISK_SQL =
	'LEAST(machine."diskGiB", COALESCE(machine."measuredDiskGib", machine."diskGiB"))';
const SUPPORT_CPU_SQL = 'machine."currentSupportCpu"';
const SUPPORT_MEMORY_SQL = 'machine."currentSupportMemoryMiB"';
const SUPPORT_DISK_SQL = 'machine."currentSupportDiskGiB"';
const PERCENT = 100;
const NOTHING_RELEASED = '0';

function committedSql(
	reserved: string,
	released: string,
	usagePercentage: string,
	allocated: string,
	capacity: string
): string {
	return `GREATEST(${reserved}, ${usagePercentage} / ${PERCENT}.0 * ${capacity} - ${released} + GREATEST(0, ${reserved} + ${released} - ${allocated}))`;
}

function gpuReserveSql(capacity: string): string {
	return `COALESCE((machine."gpuCount" - fit_load.gpu - ?) * ${capacity} / NULLIF(machine."gpuCount", 0), 0)`;
}

const COMMITTED_MEMORY_SQL = committedSql(
	`(fit_load.memory + ${SUPPORT_MEMORY_SQL})`,
	'fit_load.released_memory',
	'machine."currentMemoryUsagePercentage"',
	'machine."currentAllocatedMemoryMiB"',
	CAPACITY_MEMORY_SQL
);

const COMMITTED_DISK_SQL = committedSql(
	`(fit_load.disk + ${SUPPORT_DISK_SQL})`,
	NOTHING_RELEASED,
	'machine."currentDiskUsagePercentage"',
	'machine."currentAllocatedDiskGiB"',
	CAPACITY_DISK_SQL
);

function fitSql(load: SqlFragment): string {
	return `EXISTS (SELECT 1 FROM (${load.sql}) fit_load
	WHERE fit_load.cpu + ${SUPPORT_CPU_SQL} + ${cpuFootprintSql('?')} + ${gpuReserveSql(CAPACITY_CPU_SQL)} <= ${CAPACITY_CPU_SQL}
		AND ${COMMITTED_MEMORY_SQL} + ${memoryFootprintSql('?')} + ${gpuReserveSql(CAPACITY_MEMORY_SQL)} <= ${CAPACITY_MEMORY_SQL}
		AND ${COMMITTED_DISK_SQL} + ? <= ${CAPACITY_DISK_SQL}
		AND fit_load.gpu + ? <= machine."gpuCount")`;
}

function wholeMachineFitSql(load: SqlFragment): string {
	return `EXISTS (SELECT 1 FROM (${load.sql}) fit_load
	WHERE fit_load.cpu = 0 AND fit_load.memory = 0 AND fit_load.gpu = 0
		AND ${SUPPORT_CPU_SQL} = 0 AND ${SUPPORT_MEMORY_SQL} = 0
		AND fit_load.converging = 0
		AND ${COMMITTED_DISK_SQL} + ? <= ${CAPACITY_DISK_SQL})`;
}

const NOT_RENTED_WHOLE_SQL = `NOT EXISTS (SELECT 1 FROM sandbox sandbox_usage
	WHERE sandbox_usage."machineId" = machine.id
		AND sandbox_usage."placementWholeMachine"
		AND ${COMPUTE_USAGE_SQL})`;

export function hostGateSql(): SqlFragment {
	return {
		sql: `machine.state = ? AND machine.unschedulable = false AND machine.draining = false
			AND machine."sessionExpiresAt" > transaction_timestamp()`,
		bindings: [MachineState.READY],
	};
}

export function workloadGateSql(
	shape: ResourceShapeFields,
	compute: SqlFragment
): SqlFragment {
	const load = machineLoad(compute);
	return {
		sql: fitSql(load),
		bindings: [
			...load.bindings,
			shape.cpu,
			shape.gpu,
			shape.memoryGiB,
			shape.gpu,
			shape.diskGiB,
			shape.gpu,
		],
	};
}

export function wholeMachineGateSql(
	diskGiB: number,
	compute: SqlFragment
): SqlFragment {
	const load = machineLoad(compute);
	return {
		sql: wholeMachineFitSql(load),
		bindings: [...load.bindings, diskGiB],
	};
}

export function notRentedWholeSql(): SqlFragment {
	return { sql: NOT_RENTED_WHOLE_SQL, bindings: [...COMPUTE_USAGE_BINDINGS] };
}
