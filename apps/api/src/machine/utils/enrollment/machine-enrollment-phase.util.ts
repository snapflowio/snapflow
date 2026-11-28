/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ListingState } from '../../../marketplace/enums/listing-state.enum';
import { BenchmarkState } from '../../../verification/enums/benchmark-state.enum';
import type { Machine } from '../../entities/machine.entity';
import { MachineEnrollmentPhase } from '../../enums/machine-enrollment-phase.enum';
import { MachineState } from '../../enums/machine-state.enum';

export type MachineEnrollmentMachine = Pick<
	Machine,
	'state' | 'lastChecked' | 'restrictedAt'
>;

export interface MachineEnrollmentMarketplace {
	listingState: ListingState;
	latestBenchmark: { state: BenchmarkState } | null;
	benchmarkExpiresAt: Date | null;
}

const FAILED_MACHINE_STATES: ReadonlySet<MachineState> = new Set([
	MachineState.FAILED,
	MachineState.DISABLED,
]);

const ADMITTED_MACHINE_STATES: ReadonlySet<MachineState> = new Set([
	MachineState.READY,
	MachineState.DRAINING,
]);

const UNBENCHMARKED_PHASE = {
	[BenchmarkState.PENDING]: MachineEnrollmentPhase.BENCHMARKING,
	[BenchmarkState.DEFERRED]: MachineEnrollmentPhase.BENCHMARK_DEFERRED,
	[BenchmarkState.FAILED]: MachineEnrollmentPhase.BENCHMARK_FAILED,
	[BenchmarkState.PASSED]: MachineEnrollmentPhase.BENCHMARK_EXPIRED,
} as const satisfies Record<BenchmarkState, MachineEnrollmentPhase>;

function failurePhase(
	machine: MachineEnrollmentMachine
): MachineEnrollmentPhase | null {
	if (machine.state === MachineState.DECOMMISSIONED) {
		return MachineEnrollmentPhase.DECOMMISSIONED;
	}
	if (FAILED_MACHINE_STATES.has(machine.state)) {
		return MachineEnrollmentPhase.FAILED;
	}
	if (machine.state === MachineState.UNRESPONSIVE) {
		return MachineEnrollmentPhase.UNRESPONSIVE;
	}
	return machine.restrictedAt === null
		? null
		: MachineEnrollmentPhase.RESTRICTED;
}

export function machineEnrollmentPhase(
	machine: MachineEnrollmentMachine,
	marketplace: MachineEnrollmentMarketplace | null
): MachineEnrollmentPhase {
	const failure = failurePhase(machine);
	if (failure !== null) return failure;
	if (machine.lastChecked === null) return MachineEnrollmentPhase.CONNECTING;
	const benchmark = marketplace?.latestBenchmark?.state ?? null;
	if (benchmark === null) return MachineEnrollmentPhase.CONNECTED;
	if (benchmark === BenchmarkState.FAILED || !marketplace?.benchmarkExpiresAt) {
		return UNBENCHMARKED_PHASE[benchmark];
	}
	if (!ADMITTED_MACHINE_STATES.has(machine.state)) {
		return MachineEnrollmentPhase.AWAITING_APPROVAL;
	}
	return marketplace?.listingState === ListingState.LISTED
		? MachineEnrollmentPhase.LISTED
		: MachineEnrollmentPhase.READY_TO_LIST;
}
