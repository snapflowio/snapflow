/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { NetworkingEvents } from '../../../networking/constants/networking-events.constants';
import type { NetworkBudgetThresholdReachedEvent } from '../../../networking/usage/events/network-budget-threshold-reached.event';
import { SandboxEvents } from '../../../sandbox/constants/sandbox-events.constants';
import { SandboxDto } from '../../../sandbox/dto/sandbox.dto';
import { SandboxDesiredState } from '../../../sandbox/enums/sandbox-desired-state.enum';
import { SandboxState } from '../../../sandbox/enums/sandbox-state.enum';
import { MachineEvents } from '../../../sandbox/machine/constants/machine-events.constants';
import { MachineDto } from '../../../sandbox/machine/dto/machine.dto';
import { MachineState } from '../../../sandbox/machine/enums/machine-state.enum';
import { SnapshotEvents } from '../../../sandbox/snapshot/constants/snapshot-events.constants';
import { SnapshotDto } from '../../../sandbox/snapshot/dto/snapshot.dto';
import { SnapshotState } from '../../../sandbox/snapshot/enums/snapshot-state.enum';
import { VolumeEvents } from '../../../sandbox/volume/constants/volume-events.constants';
import { VolumeDto } from '../../../sandbox/volume/dto/volume.dto';
import { VolumeState } from '../../../sandbox/volume/enums/volume-state.enum';
import { NOTIFICATION_ROOM_PREFIXES } from '../constants/notification.constants';

export type NotificationCredential = Pick<
	OrganizationAuthContext['credential'],
	'type' | 'id'
>;

export interface NotificationBroadcast {
	emit(event: string, payload: unknown): unknown;
	disconnectSockets(close: boolean): void;
}

export function userRoom(userId: string): string {
	return `${NOTIFICATION_ROOM_PREFIXES.USER}:${userId}`;
}

export function organizationRoom(organizationId: string): string {
	return `${NOTIFICATION_ROOM_PREFIXES.ORGANIZATION}:${organizationId}`;
}

export function memberRoom(organizationId: string, userId: string): string {
	return `${NOTIFICATION_ROOM_PREFIXES.MEMBER}:${organizationId}:${userId}`;
}

const ORGANIZATION_SCOPED_ROOM_PREFIXES = [
	NOTIFICATION_ROOM_PREFIXES.ORGANIZATION,
	NOTIFICATION_ROOM_PREFIXES.MEMBER,
].map((prefix) => `${prefix}:`);

export function isOrganizationScopedRoom(room: string): boolean {
	return ORGANIZATION_SCOPED_ROOM_PREFIXES.some((prefix) =>
		room.startsWith(prefix)
	);
}

export function credentialRoom(credential: NotificationCredential): string {
	return `${NOTIFICATION_ROOM_PREFIXES.CREDENTIAL}:${credential.type}:${credential.id}`;
}

export abstract class NotificationEmitter {
	protected abstract broadcast(room: string): NotificationBroadcast;

	emitSandboxCreated(sandbox: SandboxDto): void {
		this.emitToOrganization(
			sandbox.organizationId,
			SandboxEvents.CREATED,
			sandbox
		);
	}

	emitSandboxStateUpdated(
		sandbox: SandboxDto,
		oldState: SandboxState,
		newState: SandboxState
	): void {
		this.emitToOrganization(
			sandbox.organizationId,
			SandboxEvents.STATE_UPDATED,
			{
				sandbox,
				oldState,
				newState,
			}
		);
	}

	emitSandboxDesiredStateUpdated(
		sandbox: SandboxDto,
		oldDesiredState: SandboxDesiredState,
		newDesiredState: SandboxDesiredState
	): void {
		this.emitToOrganization(
			sandbox.organizationId,
			SandboxEvents.DESIRED_STATE_UPDATED,
			{
				sandbox,
				oldDesiredState,
				newDesiredState,
			}
		);
	}

	emitSandboxLeaseRenewalRequired(
		sandbox: SandboxDto,
		leaseId: string,
		renewalDeadline: Date
	): void {
		this.emitToOrganization(
			sandbox.organizationId,
			SandboxEvents.LEASE_RENEWAL_REQUIRED,
			{ sandbox, leaseId, renewalDeadline }
		);
	}

	emitNetworkBudgetThresholdReached(
		event: NetworkBudgetThresholdReachedEvent
	): void {
		this.emitToOrganization(
			event.organizationId,
			NetworkingEvents.NETWORK_BUDGET_THRESHOLD_REACHED,
			{
				thresholdBasisPoints: event.thresholdBasisPoints,
				spendMicroUsd: event.spendMicroUsd,
				limitMicroUsd: event.limitMicroUsd,
				throttled: event.throttled,
			}
		);
	}

	emitSnapshotCreated(snapshot: SnapshotDto): void {
		this.emitToOrganization(
			snapshot.organizationId,
			SnapshotEvents.CREATED,
			snapshot
		);
	}

	emitSnapshotStateUpdated(
		snapshot: SnapshotDto,
		oldState: SnapshotState,
		newState: SnapshotState
	): void {
		this.emitToOrganization(
			snapshot.organizationId,
			SnapshotEvents.STATE_UPDATED,
			{
				snapshot,
				oldState,
				newState,
			}
		);
	}

	emitSnapshotRemoved(snapshot: SnapshotDto): void {
		this.emitToOrganization(
			snapshot.organizationId,
			SnapshotEvents.REMOVED,
			snapshot
		);
	}

	emitVolumeCreated(volume: VolumeDto): void {
		this.emitToOrganization(
			volume.organizationId,
			VolumeEvents.CREATED,
			volume
		);
	}

	emitVolumeStateUpdated(
		volume: VolumeDto,
		oldState: VolumeState,
		newState: VolumeState
	): void {
		this.emitToOrganization(volume.organizationId, VolumeEvents.STATE_UPDATED, {
			volume,
			oldState,
			newState,
		});
	}

	emitVolumeLastUsedAtUpdated(volume: VolumeDto): void {
		this.emitToOrganization(
			volume.organizationId,
			VolumeEvents.LAST_USED_AT_UPDATED,
			volume
		);
	}

	emitMachineCreated(machine: MachineDto): void {
		this.emitToOrganization(
			machine.organizationId,
			MachineEvents.CREATED,
			machine
		);
	}

	emitMachineStateUpdated(
		machine: MachineDto,
		oldState: MachineState,
		newState: MachineState
	): void {
		this.emitToOrganization(
			machine.organizationId,
			MachineEvents.STATE_UPDATED,
			{
				machine,
				oldState,
				newState,
			}
		);
	}

	emitMachineUnschedulableUpdated(machine: MachineDto): void {
		this.emitToOrganization(
			machine.organizationId,
			MachineEvents.UNSCHEDULABLE_UPDATED,
			machine
		);
	}

	evictUser(userId: string): void {
		this.broadcast(userRoom(userId)).disconnectSockets(true);
	}

	evictOrganization(organizationId: string): void {
		this.broadcast(organizationRoom(organizationId)).disconnectSockets(true);
	}

	evictMember(organizationId: string, userId: string): void {
		this.broadcast(memberRoom(organizationId, userId)).disconnectSockets(true);
	}

	evictCredential(credential: NotificationCredential): void {
		this.broadcast(credentialRoom(credential)).disconnectSockets(true);
	}

	private emitToOrganization(
		organizationId: string | null | undefined,
		event: string,
		payload: unknown
	): void {
		if (!organizationId) return;
		this.broadcast(organizationRoom(organizationId)).emit(event, payload);
	}
}
