/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SandboxLifecycle,
	type SandboxObservedStatus,
	SandboxRuntimeState,
} from '@snapflow/machine-proto';
import { BackupState } from '../../volume/enums/backup-state.enum';
import {
	type ActiveLifecycle,
	CONVERGED_RUNTIME_STATE,
	FAILURE_ABSORBING_STATES,
	INTERRUPTED_OPERATION_FAILURE,
	OBSERVED_START_RESUMABLE_STATES,
	OBSERVED_TRANSITION,
	type ObservedTransition,
	PAYMENT_HOLDABLE_STATES,
	PAYMENT_RESUMABLE_STATES,
	PENDING_RUNTIME_STATES,
	START_RETRY_ERROR_CODES,
	START_RETRY_STATES,
	STARTING_STATES,
	STOPPED_CONVERGENCE_TRANSITION,
	UNEXPECTED_STOP_IGNORED_STATES,
	UNEXPECTED_STOP_LIFECYCLES,
} from '../constants/sandbox-state-machine.constants';
import type { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { heldForPayment } from '../utils/runtime/runtime-convergence.util';

type ObservedSandbox = Pick<
	Sandbox,
	| 'state'
	| 'desiredState'
	| 'specGeneration'
	| 'runtimeLifecycle'
	| 'backupState'
	| 'pausedForPayment'
> & {
	recoveryRequested: boolean;
};

type Observation = Pick<
	SandboxObservedStatus,
	'state' | 'observedSpecGeneration' | 'paymentHeld' | 'result'
>;

export class SandboxStateMachine {
	private readonly convergedTransitions: Readonly<
		Record<ActiveLifecycle, () => ObservedTransition>
	> = {
		[SandboxLifecycle.STARTED]: () => this.started(),
		[SandboxLifecycle.STOPPED]: () => this.stopped(),
		[SandboxLifecycle.PAUSED]: () => this.paused(),
		[SandboxLifecycle.DESTROYED]: () => this.removed(),
	};

	constructor(private readonly sandbox: ObservedSandbox) {}

	transitionFor(observation: Observation): ObservedTransition {
		const lifecycle = this.sandbox.runtimeLifecycle;
		if (
			lifecycle === null ||
			lifecycle === SandboxLifecycle.UNSPECIFIED ||
			observation.observedSpecGeneration !== this.sandbox.specGeneration ||
			PENDING_RUNTIME_STATES.has(observation.state)
		) {
			return OBSERVED_TRANSITION.NONE;
		}
		if (observation.state === SandboxRuntimeState.ERROR) {
			return this.retriesStart(observation)
				? OBSERVED_TRANSITION.START_RETRY
				: this.failed(lifecycle);
		}
		if (observation.state === SandboxRuntimeState.MISSING) {
			return lifecycle === SandboxLifecycle.DESTROYED
				? this.removed()
				: this.failed(lifecycle);
		}
		if (observation.state === CONVERGED_RUNTIME_STATE[lifecycle]) {
			return this.convergedTransitions[lifecycle]();
		}
		if (heldForPayment(lifecycle, observation)) {
			return this.paymentHold();
		}
		if (
			observation.state === SandboxRuntimeState.STOPPED &&
			UNEXPECTED_STOP_LIFECYCLES.has(lifecycle)
		) {
			return UNEXPECTED_STOP_IGNORED_STATES.has(this.sandbox.state)
				? OBSERVED_TRANSITION.NONE
				: OBSERVED_TRANSITION.STOPPED_UNEXPECTEDLY;
		}
		return this.failed(lifecycle);
	}

	private retriesStart({ result }: Observation): boolean {
		return (
			result?.retryable === true &&
			START_RETRY_ERROR_CODES.has(result.errorCode) &&
			this.sandbox.desiredState === SandboxDesiredState.STARTED &&
			START_RETRY_STATES.has(this.sandbox.state)
		);
	}

	private started(): ObservedTransition {
		if (
			STARTING_STATES.has(this.sandbox.state) ||
			(this.sandbox.state === SandboxState.PAUSED &&
				this.sandbox.pausedForPayment)
		) {
			return OBSERVED_TRANSITION.STARTED;
		}
		return OBSERVED_START_RESUMABLE_STATES.has(this.sandbox.state) &&
			this.sandbox.desiredState === SandboxDesiredState.STARTED
			? OBSERVED_TRANSITION.STARTED
			: OBSERVED_TRANSITION.NONE;
	}

	private stopped(): ObservedTransition {
		if (this.sandbox.state === SandboxState.ERROR) {
			if (this.sandbox.recoveryRequested) return OBSERVED_TRANSITION.RECOVERED;
			return this.sandbox.desiredState === SandboxDesiredState.STOPPED
				? OBSERVED_TRANSITION.STOPPED
				: OBSERVED_TRANSITION.NONE;
		}
		return (
			STOPPED_CONVERGENCE_TRANSITION[this.sandbox.state] ??
			OBSERVED_TRANSITION.NONE
		);
	}

	private paused(): ObservedTransition {
		return this.sandbox.state === SandboxState.PAUSING
			? OBSERVED_TRANSITION.PAUSED
			: OBSERVED_TRANSITION.NONE;
	}

	private paymentHold(): ObservedTransition {
		const holdable =
			PAYMENT_HOLDABLE_STATES.has(this.sandbox.state) ||
			(PAYMENT_RESUMABLE_STATES.has(this.sandbox.state) &&
				this.sandbox.desiredState === SandboxDesiredState.STARTED);
		return holdable
			? OBSERVED_TRANSITION.HELD_FOR_PAYMENT
			: OBSERVED_TRANSITION.NONE;
	}

	private removed(): ObservedTransition {
		if (this.sandbox.desiredState === SandboxDesiredState.DESTROYED) {
			return this.sandbox.state === SandboxState.DESTROYED
				? OBSERVED_TRANSITION.NONE
				: OBSERVED_TRANSITION.DESTROYED;
		}
		return this.sandbox.desiredState === SandboxDesiredState.ARCHIVED &&
			this.sandbox.backupState === BackupState.COMPLETED &&
			this.sandbox.state !== SandboxState.ARCHIVED
			? OBSERVED_TRANSITION.ARCHIVED
			: OBSERVED_TRANSITION.NONE;
	}

	private failed(lifecycle: SandboxLifecycle): ObservedTransition {
		if (
			lifecycle === SandboxLifecycle.DESTROYED &&
			this.removed() === OBSERVED_TRANSITION.ARCHIVED
		) {
			return OBSERVED_TRANSITION.ARCHIVED;
		}
		if (this.sandbox.state === SandboxState.RESTORING) {
			return this.sandbox.desiredState === SandboxDesiredState.STOPPED
				? OBSERVED_TRANSITION.MIGRATION_FAILED
				: OBSERVED_TRANSITION.CREATE_FAILED;
		}
		const interrupted = INTERRUPTED_OPERATION_FAILURE[this.sandbox.state];
		if (interrupted) return interrupted;
		if (
			this.sandbox.state === SandboxState.ERROR &&
			this.sandbox.recoveryRequested
		) {
			return OBSERVED_TRANSITION.RECOVERY_FAILED;
		}
		return FAILURE_ABSORBING_STATES.has(this.sandbox.state)
			? OBSERVED_TRANSITION.NONE
			: OBSERVED_TRANSITION.FAILED;
	}
}
