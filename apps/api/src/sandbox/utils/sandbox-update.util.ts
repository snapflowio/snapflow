/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityData } from '@mikro-orm/core';
import { ResourceShape } from '../../common/values/resource-shape.value';
import { SandboxEvents } from '../constants/sandbox-events.constants';
import type { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SandboxDesiredStateUpdatedEvent } from '../events/sandbox-desired-state-updated.event';
import { SandboxMachineUpdatedEvent } from '../events/sandbox-machine-updated.event';
import { SandboxStateUpdatedEvent } from '../events/sandbox-state-updated.event';
import type { DesiredStateFields } from '../machine/utils/desired-state/desired-state-change.util';

export type SandboxConcurrencyGuard = Pick<
	Sandbox,
	| 'state'
	| 'desiredState'
	| 'pending'
	| 'organizationId'
	| 'machineId'
	| 'specGeneration'
>;

export type SandboxSnapshot = SandboxConcurrencyGuard & DesiredStateFields;

type SandboxEventFields = Pick<Sandbox, 'state' | 'desiredState' | 'machineId'>;

type PlacementFields = Pick<
	Sandbox,
	'cpu' | 'mem' | 'disk' | 'gpu' | 'desiredState'
>;

const SANDBOX_STATES: ReadonlySet<unknown> = new Set(
	Object.values(SandboxState)
);
const SANDBOX_DESIRED_STATES: ReadonlySet<unknown> = new Set(
	Object.values(SandboxDesiredState)
);

export function persistedConcurrencyGuard(
	sandbox: Sandbox,
	persisted: EntityData<Sandbox> | undefined
): SandboxConcurrencyGuard {
	const guard: SandboxConcurrencyGuard = {
		state: sandbox.state,
		desiredState: sandbox.desiredState,
		pending: sandbox.pending,
		organizationId: sandbox.organizationId,
		machineId: sandbox.machineId,
		specGeneration: sandbox.specGeneration,
	};
	if (!persisted) return guard;
	const {
		state,
		desiredState,
		pending,
		organizationId,
		machineId,
		specGeneration,
	} = persisted;
	return {
		state: isSandboxState(state) ? state : guard.state,
		desiredState: isSandboxDesiredState(desiredState)
			? desiredState
			: guard.desiredState,
		pending: typeof pending === 'boolean' ? pending : guard.pending,
		organizationId:
			typeof organizationId === 'string'
				? organizationId
				: guard.organizationId,
		machineId:
			typeof machineId === 'string' || machineId === null
				? machineId
				: guard.machineId,
		specGeneration:
			typeof specGeneration === 'number'
				? specGeneration
				: guard.specGeneration,
	};
}

export function placementSynchronizationOptions(
	previous: PlacementFields,
	current: PlacementFields
) {
	return {
		replacePlacement: !ResourceShape.fromSandbox(previous).equals(
			ResourceShape.fromSandbox(current)
		),
		renewBillingAuthorization:
			previous.desiredState !== SandboxDesiredState.STARTED &&
			current.desiredState === SandboxDesiredState.STARTED,
	};
}

export function sandboxUpdateEvents(
	updatedSandbox: Sandbox,
	previousSandbox: SandboxEventFields
): [string, object][] {
	const events: [string, object][] = [];
	if (previousSandbox.state !== updatedSandbox.state) {
		events.push([
			SandboxEvents.STATE_UPDATED,
			new SandboxStateUpdatedEvent(
				updatedSandbox,
				previousSandbox.state,
				updatedSandbox.state
			),
		]);
	}
	if (previousSandbox.desiredState !== updatedSandbox.desiredState) {
		events.push([
			SandboxEvents.DESIRED_STATE_UPDATED,
			new SandboxDesiredStateUpdatedEvent(
				updatedSandbox,
				previousSandbox.desiredState,
				updatedSandbox.desiredState
			),
		]);
	}
	if (previousSandbox.machineId !== updatedSandbox.machineId) {
		events.push([
			SandboxEvents.MACHINE_UPDATED,
			new SandboxMachineUpdatedEvent(
				updatedSandbox,
				previousSandbox.machineId ?? null,
				updatedSandbox.machineId ?? null
			),
		]);
	}
	return events;
}

function isSandboxState(value: unknown): value is SandboxState {
	return SANDBOX_STATES.has(value);
}

function isSandboxDesiredState(value: unknown): value is SandboxDesiredState {
	return SANDBOX_DESIRED_STATES.has(value);
}
