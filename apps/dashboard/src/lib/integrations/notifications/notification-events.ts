/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	Machine,
	MachineState,
	Sandbox,
	SandboxDesiredState,
	SandboxState,
	SnapshotDto,
	SnapshotState,
	VolumeDto,
	VolumeState,
} from '@snapflow/api-client';

export const NotificationEvent = {
	NETWORK_BUDGET_THRESHOLD_REACHED:
		'networking.network-budget.threshold-reached',
	MACHINE_CREATED: 'machine.created',
	MACHINE_DELETED: 'machine.deleted',
	MACHINE_STATE_UPDATED: 'machine.state.updated',
	MACHINE_UNSCHEDULABLE_UPDATED: 'machine.unschedulable.updated',
	SANDBOX_CREATED: 'sandbox.created',
	SANDBOX_DESIRED_STATE_UPDATED: 'sandbox.desired-state.updated',
	SANDBOX_STATE_UPDATED: 'sandbox.state.updated',
	SNAPSHOT_CREATED: 'snapshot.created',
	SNAPSHOT_REMOVED: 'snapshot.removed',
	SNAPSHOT_STATE_UPDATED: 'snapshot.state.updated',
	VOLUME_CREATED: 'volume.created',
	VOLUME_LAST_USED_AT_UPDATED: 'volume.lastUsedAt.updated',
	VOLUME_STATE_UPDATED: 'volume.state.updated',
} as const;

interface StateUpdate<State> {
	oldState: State;
	newState: State;
}

export interface NetworkBudgetThresholdReached {
	thresholdBasisPoints: number;
	spendMicroUsd: string;
	limitMicroUsd: string;
	throttled: boolean;
}

export interface NotificationServerEvents {
	[NotificationEvent.NETWORK_BUDGET_THRESHOLD_REACHED]: (
		alert: NetworkBudgetThresholdReached
	) => void;
	[NotificationEvent.MACHINE_CREATED]: (machine: Machine) => void;
	[NotificationEvent.MACHINE_DELETED]: (machine: Machine) => void;
	[NotificationEvent.MACHINE_STATE_UPDATED]: (
		update: StateUpdate<MachineState> & { machine: Machine }
	) => void;
	[NotificationEvent.MACHINE_UNSCHEDULABLE_UPDATED]: (machine: Machine) => void;
	[NotificationEvent.SANDBOX_CREATED]: (sandbox: Sandbox) => void;
	[NotificationEvent.SANDBOX_DESIRED_STATE_UPDATED]: (update: {
		sandbox: Sandbox;
		oldDesiredState: SandboxDesiredState;
		newDesiredState: SandboxDesiredState;
	}) => void;
	[NotificationEvent.SANDBOX_STATE_UPDATED]: (
		update: StateUpdate<SandboxState> & { sandbox: Sandbox }
	) => void;
	[NotificationEvent.SNAPSHOT_CREATED]: (snapshot: SnapshotDto) => void;
	[NotificationEvent.SNAPSHOT_REMOVED]: (snapshot: SnapshotDto) => void;
	[NotificationEvent.SNAPSHOT_STATE_UPDATED]: (
		update: StateUpdate<SnapshotState> & { snapshot: SnapshotDto }
	) => void;
	[NotificationEvent.VOLUME_CREATED]: (volume: VolumeDto) => void;
	[NotificationEvent.VOLUME_LAST_USED_AT_UPDATED]: (volume: VolumeDto) => void;
	[NotificationEvent.VOLUME_STATE_UPDATED]: (
		update: StateUpdate<VolumeState> & { volume: VolumeDto }
	) => void;
}

export type NotificationClientEvents = Record<string, never>;
