/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	MachineHealthcheckDto,
	MachineServiceHealthDto,
} from '../dto/machine-health.dto';
import type { Machine } from '../entities/machine.entity';
import { MachineReadinessState } from '../enums/machine-readiness-state.enum';
import { MachineState } from '../enums/machine-state.enum';
import { outdatedReleaseReason } from './machine-release-gate.util';
import { completeMachineActivation } from './machine-update-readiness.util';

const MACHINE_STATE_BY_READINESS = {
	[MachineReadinessState.INITIALIZING]: MachineState.INITIALIZING,
	[MachineReadinessState.READY]: MachineState.READY,
	[MachineReadinessState.DRAINING]: MachineState.DRAINING,
	[MachineReadinessState.FAILED]: MachineState.FAILED,
} as const satisfies Record<MachineReadinessState, MachineState>;

const HEALTHY_STATES: ReadonlySet<MachineState> = new Set([
	MachineState.READY,
	MachineState.DRAINING,
]);

export function unhealthyServices(
	serviceHealth: readonly MachineServiceHealthDto[] | undefined
): MachineServiceHealthDto[] {
	return serviceHealth?.filter((service) => !service.healthy) ?? [];
}

function reportedState(
	readinessState: MachineReadinessState,
	hasUnhealthyService: boolean,
	outdatedReason: string | null
): MachineState {
	if (readinessState !== MachineReadinessState.READY) {
		return MACHINE_STATE_BY_READINESS[readinessState];
	}
	if (outdatedReason !== null) return MachineState.FAILED;
	return hasUnhealthyService ? MachineState.UNRESPONSIVE : MachineState.READY;
}

export function machineHealthUpdate(
	machine: Pick<Machine, 'updateStatus' | 'runtimeCapabilities'>,
	healthcheck: MachineHealthcheckDto,
	observedAt: Date,
	minimumReleaseVersion: string | null
): Partial<Machine> {
	const readinessState = healthcheck.readiness.state;
	const hasUnhealthyService =
		unhealthyServices(healthcheck.serviceHealth).length > 0;
	const outdatedReason = outdatedReleaseReason(
		(healthcheck.runtimeCapabilities ?? machine.runtimeCapabilities)
			?.machineReleaseVersion,
		minimumReleaseVersion
	);
	const state = reportedState(
		readinessState,
		hasUnhealthyService,
		outdatedReason
	);
	return {
		state,
		readinessReason:
			outdatedReason ?? (healthcheck.readiness.reason?.trim() || null),
		lastChecked: observedAt,
		...(HEALTHY_STATES.has(state) && !hasUnhealthyService
			? { lastHealthyAt: observedAt }
			: {}),
		sshHostPublicKey: healthcheck.sshHostPublicKey?.trim() || null,
		serviceHealth: healthcheck.serviceHealth ?? null,
		...(healthcheck.appVersion ? { appVersion: healthcheck.appVersion } : {}),
		...(healthcheck.runtimeCapabilities === undefined
			? {}
			: { runtimeCapabilities: healthcheck.runtimeCapabilities }),
		...healthcheck.metrics,
		...completeMachineActivation(
			machine.updateStatus,
			readinessState,
			hasUnhealthyService,
			observedAt
		),
	};
}
