/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuthEvents } from '../../../auth/constants/auth-events.constants';
import type { ApiKeyRevokedEvent } from '../../../auth/events/api-key-revoked.event';
import type { SessionRevokedEvent } from '../../../auth/events/session-revoked.event';
import { IsolatedEntityManagerContext } from '../../../common/decorators/isolated-entity-manager-context.decorator';
import { AUTH_CREDENTIAL_TYPES } from '../../../common/types/organization-auth-context.types';
import { NetworkingEvents } from '../../../networking/routing/constants/networking-events.constants';
import type { NetworkBudgetThresholdReachedEvent } from '../../../networking/usage/events/network-budget-threshold-reached.event';
import { OrganizationEvents } from '../../../organization/tenant/constants/organization-events.constants';
import type { OrganizationAuthorizationChangedEvent } from '../../../organization/tenant/events/organization-authorization-changed.event';
import type { OrganizationDeletedEvent } from '../../../organization/tenant/events/organization-deleted.event';
import type { OrganizationMembershipChangedEvent } from '../../../organization/tenant/events/organization-membership-changed.event';
import { SandboxEvents } from '../../../sandbox/instance/constants/sandbox-events.constants';
import { SandboxDto } from '../../../sandbox/instance/dto/sandbox.dto';
import { SandboxCreatedEvent } from '../../../sandbox/instance/events/sandbox-create.event';
import { SandboxDesiredStateUpdatedEvent } from '../../../sandbox/instance/events/sandbox-desired-state-updated.event';
import { SandboxLeaseRenewalRequiredEvent } from '../../../sandbox/instance/events/sandbox-lease-renewal-required.event';
import { SandboxStateUpdatedEvent } from '../../../sandbox/instance/events/sandbox-state-updated.event';
import { SandboxService } from '../../../sandbox/instance/services/sandbox/sandbox.service';
import { MachineEvents } from '../../../sandbox/machine/constants/machine-events.constants';
import { MachineCreatedEvent } from '../../../sandbox/machine/events/machine-created.event';
import { MachineStateUpdatedEvent } from '../../../sandbox/machine/events/machine-state-updated.event';
import { MachineUnschedulableUpdatedEvent } from '../../../sandbox/machine/events/machine-unschedulable-updated.event';
import { SnapshotEvents } from '../../../sandbox/snapshot/constants/snapshot-events.constants';
import { SnapshotCreatedEvent } from '../../../sandbox/snapshot/events/snapshot-created.event';
import { SnapshotRemovedEvent } from '../../../sandbox/snapshot/events/snapshot-removed.event';
import { SnapshotStateUpdatedEvent } from '../../../sandbox/snapshot/events/snapshot-state-updated.event';
import { VolumeEvents } from '../../../sandbox/volume/constants/volume-events.constants';
import { VolumeCreatedEvent } from '../../../sandbox/volume/events/volume-created.event';
import { VolumeLastUsedAtUpdatedEvent } from '../../../sandbox/volume/events/volume-last-used-at-updated.event';
import { VolumeStateUpdatedEvent } from '../../../sandbox/volume/events/volume-state-updated.event';
import { UserEvents } from '../../../user/constants/user-events.constants';
import type { UserAuthorizationChangedEvent } from '../../../user/events/user-authorization-changed.event';
import type { UserDeletedEvent } from '../../../user/events/user-deleted.event';
import { NotificationEmitter } from '../../transport/gateways/notification-emitter.abstract';

@Injectable()
export class NotificationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly notificationEmitter: NotificationEmitter,
		private readonly sandboxService: SandboxService
	) {}

	get em(): EntityManager {
		return this.entityManager;
	}

	@OnEvent(UserEvents.AUTHORIZATION_CHANGED)
	handleUserAuthorizationChanged(event: UserAuthorizationChangedEvent): void {
		this.notificationEmitter.evictUser(event.userId);
	}

	@OnEvent(OrganizationEvents.AUTHORIZATION_CHANGED)
	handleOrganizationAuthorizationChanged(
		event: OrganizationAuthorizationChangedEvent
	): void {
		this.notificationEmitter.evictOrganization(event.organizationId);
	}

	@OnEvent(OrganizationEvents.DELETED)
	handleOrganizationDeleted(event: OrganizationDeletedEvent): void {
		this.notificationEmitter.evictOrganization(event.organizationId);
	}

	@OnEvent(OrganizationEvents.MEMBERSHIP_CHANGED)
	handleOrganizationMembershipChanged(
		event: OrganizationMembershipChangedEvent
	): void {
		this.notificationEmitter.evictMember(event.organizationId, event.userId);
	}

	@OnEvent(UserEvents.DELETED)
	handleUserDeleted(event: UserDeletedEvent): void {
		this.notificationEmitter.evictUser(event.userId);
	}

	@OnEvent(AuthEvents.SESSION_REVOKED)
	handleSessionRevoked(event: SessionRevokedEvent): void {
		this.notificationEmitter.evictCredential({
			type: AUTH_CREDENTIAL_TYPES.SESSION,
			id: event.sessionId,
		});
	}

	@OnEvent(AuthEvents.API_KEY_REVOKED)
	handleApiKeyRevoked(event: ApiKeyRevokedEvent): void {
		this.notificationEmitter.evictCredential({
			type: AUTH_CREDENTIAL_TYPES.API_KEY,
			id: event.apiKeyId,
		});
	}

	@OnEvent(SandboxEvents.CREATED)
	@IsolatedEntityManagerContext()
	async handleSandboxCreated(event: SandboxCreatedEvent) {
		const dto = await this.currentSandboxDto(event.sandbox.id);
		this.notificationEmitter.emitSandboxCreated(dto);
	}

	@OnEvent(SandboxEvents.STATE_UPDATED)
	@IsolatedEntityManagerContext()
	async handleSandboxStateUpdated(event: SandboxStateUpdatedEvent) {
		const dto = await this.currentSandboxDto(event.sandbox.id);
		this.notificationEmitter.emitSandboxStateUpdated(
			dto,
			event.oldState,
			event.newState
		);
	}

	@OnEvent(SandboxEvents.DESIRED_STATE_UPDATED)
	@IsolatedEntityManagerContext()
	async handleSandboxDesiredStateUpdated(
		event: SandboxDesiredStateUpdatedEvent
	) {
		const dto = await this.currentSandboxDto(event.sandbox.id);
		this.notificationEmitter.emitSandboxDesiredStateUpdated(
			dto,
			event.oldDesiredState,
			event.newDesiredState
		);
	}

	@OnEvent(SandboxEvents.LEASE_RENEWAL_REQUIRED)
	@IsolatedEntityManagerContext()
	async handleSandboxLeaseRenewalRequired(
		event: SandboxLeaseRenewalRequiredEvent
	) {
		const dto = await this.currentSandboxDto(event.sandbox.id);
		this.notificationEmitter.emitSandboxLeaseRenewalRequired(
			dto,
			event.leaseId,
			event.renewalDeadline
		);
	}

	@OnEvent(NetworkingEvents.NETWORK_BUDGET_THRESHOLD_REACHED)
	handleNetworkBudgetThresholdReached(
		event: NetworkBudgetThresholdReachedEvent
	): void {
		this.notificationEmitter.emitNetworkBudgetThresholdReached(event);
	}

	@OnEvent(SnapshotEvents.CREATED)
	handleSnapshotCreated(event: SnapshotCreatedEvent): void {
		this.notificationEmitter.emitSnapshotCreated(event.snapshot);
	}

	@OnEvent(SnapshotEvents.STATE_UPDATED)
	handleSnapshotStateUpdated(event: SnapshotStateUpdatedEvent): void {
		this.notificationEmitter.emitSnapshotStateUpdated(
			event.snapshot,
			event.oldState,
			event.newState
		);
	}

	@OnEvent(SnapshotEvents.REMOVED)
	handleSnapshotRemoved(event: SnapshotRemovedEvent): void {
		this.notificationEmitter.emitSnapshotRemoved(event.snapshot);
	}

	@OnEvent(VolumeEvents.CREATED)
	handleVolumeCreated(event: VolumeCreatedEvent): void {
		this.notificationEmitter.emitVolumeCreated(event.volume);
	}

	@OnEvent(VolumeEvents.STATE_UPDATED)
	handleVolumeStateUpdated(event: VolumeStateUpdatedEvent): void {
		this.notificationEmitter.emitVolumeStateUpdated(
			event.volume,
			event.oldState,
			event.newState
		);
	}

	@OnEvent(VolumeEvents.LAST_USED_AT_UPDATED)
	handleVolumeLastUsedAtUpdated(event: VolumeLastUsedAtUpdatedEvent): void {
		this.notificationEmitter.emitVolumeLastUsedAtUpdated(event.volume);
	}

	@OnEvent(MachineEvents.CREATED)
	handleMachineCreated(event: MachineCreatedEvent): void {
		this.notificationEmitter.emitMachineCreated(event.machine);
	}

	@OnEvent(MachineEvents.STATE_UPDATED)
	handleMachineStateUpdated(event: MachineStateUpdatedEvent): void {
		this.notificationEmitter.emitMachineStateUpdated(
			event.machine,
			event.oldState,
			event.newState
		);
	}

	@OnEvent(MachineEvents.UNSCHEDULABLE_UPDATED)
	handleMachineUnschedulableUpdated(
		event: MachineUnschedulableUpdatedEvent
	): void {
		this.notificationEmitter.emitMachineUnschedulableUpdated(event.machine);
	}

	private async currentSandboxDto(sandboxId: string): Promise<SandboxDto> {
		const returnDestroyed = true;
		return SandboxDto.from(
			await this.sandboxService.findOne(sandboxId, returnDestroyed)
		);
	}
}
