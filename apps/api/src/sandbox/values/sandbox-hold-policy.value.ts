/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SANDBOX_BILLING_HOLD,
	SANDBOX_CAPACITY_HOLD,
	type SandboxHoldMap,
	SandboxResourceHold,
} from '../constants/sandbox-resource-hold.constants';
import type { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';

export type SandboxHoldFields = Pick<Sandbox, 'state' | 'desiredState'>;

export interface SandboxHeldResources {
	compute: boolean;
	disk: boolean;
}

export interface SandboxHoldSql {
	sql: string;
	bindings: unknown[];
}

class SandboxHoldPolicy {
	private readonly computeStates: readonly SandboxState[];
	private readonly conditionalStates: readonly SandboxState[];
	private readonly diskStates: readonly SandboxState[];

	constructor(private readonly holds: SandboxHoldMap) {
		this.computeStates = this.statesHolding(SandboxResourceHold.COMPUTE);
		this.conditionalStates = this.statesHolding(
			SandboxResourceHold.COMPUTE_WHEN_STARTED
		);
		this.diskStates = this.statesHolding(
			SandboxResourceHold.COMPUTE,
			SandboxResourceHold.COMPUTE_WHEN_STARTED,
			SandboxResourceHold.DISK
		);
	}

	held(sandbox: SandboxHoldFields): SandboxHeldResources {
		if (sandbox.desiredState === SandboxDesiredState.DESTROYED) {
			return { compute: false, disk: false };
		}
		switch (this.holds[sandbox.state]) {
			case SandboxResourceHold.COMPUTE:
				return { compute: true, disk: true };
			case SandboxResourceHold.COMPUTE_WHEN_STARTED:
				return {
					compute: sandbox.desiredState === SandboxDesiredState.STARTED,
					disk: true,
				};
			case SandboxResourceHold.DISK:
				return { compute: false, disk: true };
			case SandboxResourceHold.NONE:
				return { compute: false, disk: false };
		}
	}

	holdsCompute(sandbox: SandboxHoldFields): boolean {
		return this.held(sandbox).compute;
	}

	computeSql(alias: string): SandboxHoldSql {
		return {
			sql: `((${alias}.state = ANY(ARRAY[?]::sandbox_state_enum[]) AND ${alias}."desiredState" <> ?) OR (${alias}.state = ANY(ARRAY[?]::sandbox_state_enum[]) AND ${alias}."desiredState" = ?))`,
			bindings: [
				this.computeStates,
				SandboxDesiredState.DESTROYED,
				this.conditionalStates,
				SandboxDesiredState.STARTED,
			],
		};
	}

	diskSql(alias: string): SandboxHoldSql {
		return {
			sql: `(${alias}.state = ANY(ARRAY[?]::sandbox_state_enum[]) AND ${alias}."desiredState" <> ?)`,
			bindings: [this.diskStates, SandboxDesiredState.DESTROYED],
		};
	}

	private statesHolding(
		...holds: readonly SandboxResourceHold[]
	): readonly SandboxState[] {
		return Object.values(SandboxState).filter((state) =>
			holds.includes(this.holds[state])
		);
	}
}

export const CAPACITY_HOLD = new SandboxHoldPolicy(SANDBOX_CAPACITY_HOLD);

export const BILLING_HOLD = new SandboxHoldPolicy(SANDBOX_BILLING_HOLD);

export function sameHeldResources(
	left: SandboxHeldResources,
	right: SandboxHeldResources
): boolean {
	return left.compute === right.compute && left.disk === right.disk;
}
