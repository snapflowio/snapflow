/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuthEvents } from '../../auth/constants/auth-events.constants';
import { ApiKey } from '../../auth/entities/api-key.entity';
import type { ApiKeyRevokedEvent } from '../../auth/events/api-key-revoked.event';
import type { SessionRevokedEvent } from '../../auth/events/session-revoked.event';
import { apiKeyCreator } from '../../auth/utils/api-key-metadata.util';
import { FundingEvents } from '../../billing/constants/funding.constants';
import type { ApiKeyBudgetExhaustedEvent } from '../../billing/events/api-key-budget-exhausted.event';
import type { FundingNoticeEvent } from '../../billing/events/funding-notice.event';
import { IsolatedEntityManagerContext } from '../../common/decorators/isolated-entity-manager-context.decorator';
import { AUTH_CREDENTIAL_TYPES } from '../../common/types/organization-auth-context.types';
import { settleSequentially } from '../../common/utils/concurrency/sequential-async.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import {
	EMAIL_CATEGORY,
	type NoticeEmailCategory,
} from '../../infra/email/constants/email.constants';
import { EmailService } from '../../infra/email/services/email.service';
import { MachineEvents } from '../../machine/constants/machine-events.constants';
import { Machine } from '../../machine/entities/machine.entity';
import type { MachineCheckFailedEvent } from '../../machine/events/machine-check-failed.event';
import { MachineCreatedEvent } from '../../machine/events/machine-created.event';
import { MachineStateUpdatedEvent } from '../../machine/events/machine-state-updated.event';
import { MachineUnschedulableUpdatedEvent } from '../../machine/events/machine-unschedulable-updated.event';
import { OrganizationEvents } from '../../organization/constants/organization-events.constants';
import {
	LimitsNoticeEvents,
	LimitsNoticeKind,
} from '../../organization/constants/organization-quota-tier.constants';
import { Organization } from '../../organization/entities/organization.entity';
import type { LimitsNoticeEvent } from '../../organization/events/limits-notice.event';
import type { OrganizationAuthorizationChangedEvent } from '../../organization/events/organization-authorization-changed.event';
import type { OrganizationDeletedEvent } from '../../organization/events/organization-deleted.event';
import type { OrganizationMembershipChangedEvent } from '../../organization/events/organization-membership-changed.event';
import { organizationAdminEmails } from '../../organization/queries/organization-admin-emails.query';
import { SandboxEvents } from '../../sandbox/constants/sandbox-events.constants';
import { SandboxDto } from '../../sandbox/dto/sandbox.dto';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { SandboxCreatedEvent } from '../../sandbox/events/sandbox-create.event';
import { SandboxDesiredStateUpdatedEvent } from '../../sandbox/events/sandbox-desired-state-updated.event';
import { SandboxPriceIncreaseScheduledEvent } from '../../sandbox/events/sandbox-price-increase-scheduled.event';
import { SandboxStateUpdatedEvent } from '../../sandbox/events/sandbox-state-updated.event';
import { SandboxService } from '../../sandbox/services/sandbox/sandbox.service';
import { SnapshotEvents } from '../../snapshot/constants/snapshot-events.constants';
import { SnapshotCreatedEvent } from '../../snapshot/events/snapshot-created.event';
import { SnapshotRemovedEvent } from '../../snapshot/events/snapshot-removed.event';
import { SnapshotStateUpdatedEvent } from '../../snapshot/events/snapshot-state-updated.event';
import { UserEvents } from '../../user/constants/user-events.constants';
import type { UserAuthorizationChangedEvent } from '../../user/events/user-authorization-changed.event';
import type { UserDeletedEvent } from '../../user/events/user-deleted.event';
import { VolumeEvents } from '../../volume/constants/volume-events.constants';
import { VolumeCreatedEvent } from '../../volume/events/volume-created.event';
import { VolumeLastUsedAtUpdatedEvent } from '../../volume/events/volume-last-used-at-updated.event';
import { VolumeStateUpdatedEvent } from '../../volume/events/volume-state-updated.event';
import {
	AbuseNoticeEvents,
	HOST_NOTICE_RECIPIENT_ROLES,
	HostNoticeEvents,
	HostNoticeKind,
	MACHINE_NOTICE_GRACE_SECONDS,
	MACHINE_NOTICE_KIND,
	NOTICE_COOLDOWN_SECONDS,
	NOTICE_KEY_LIST_SEPARATOR,
	NOTICE_RECIPIENT_ROLES,
	SANDBOX_NOTICE_BATCH_SECONDS,
	SandboxNoticeEvents,
} from '../constants/notice.constants';
import type { AbuseNoticeEvent } from '../events/abuse-notice.event';
import { HostNoticeEvent } from '../events/host-notice.event';
import type { MachineNoticeCheckEvent } from '../events/machine-notice-check.event';
import type { SandboxMachineUnavailableCheckEvent } from '../events/sandbox-machine-unavailable-check.event';
import { NotificationEmitter } from '../gateways/notification-emitter.abstract';
import {
	type NoticeAudience,
	noticeRecipients,
} from '../queries/notice-recipients.query';
import type { NoticeCopy } from '../types/notice.types';
import { abuseNoticeCopy } from '../utils/abuse-notice-copy.util';
import { apiKeyBudgetNoticeCopy } from '../utils/api-key-notice-copy.util';
import { fundingNoticeCopy } from '../utils/funding-notice-copy.util';
import { hostNoticeCopy } from '../utils/host-notice-copy.util';
import { limitsNoticeCopy } from '../utils/limits-notice-copy.util';
import {
	isNoticedMachineState,
	noticedMachineCheckFailures,
} from '../utils/machine-notice.util';
import { noticeUrl } from '../utils/notice-format.util';
import {
	cooldownNoticeKey,
	enqueueHostNotice,
	enqueueMachineNoticeCheck,
	enqueueSandboxMachineUnavailableCheck,
	machineUnavailableNoticeKey,
	noticeKey,
} from '../utils/notice-outbox.util';
import { machineUnavailableNoticeCopy } from '../utils/sandbox-notice-copy.util';

@Injectable()
export class NotificationService {
	private readonly logger = new Logger(NotificationService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly notificationEmitter: NotificationEmitter,
		private readonly sandboxService: SandboxService,
		private readonly email: EmailService,
		private readonly config: TypedConfigService
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
		if (event.newState === SandboxState.MACHINE_UNAVAILABLE) {
			await this.queueMachineUnavailableNotice(event.sandbox.id);
		}
	}

	@OnEvent(SandboxNoticeEvents.MACHINE_UNAVAILABLE_CHECK)
	@IsolatedEntityManagerContext()
	async handleSandboxMachineUnavailableCheck(
		event: SandboxMachineUnavailableCheckEvent
	) {
		const [first, ...rest] = await this.entityManager.find(
			Sandbox,
			{
				organizationId: event.organizationId,
				machineId: event.machineId,
				state: SandboxState.MACHINE_UNAVAILABLE,
			},
			{
				fields: ['name', 'backupState', 'lastBackupAt'],
				orderBy: { name: QueryOrder.ASC },
			}
		);
		if (!first) return;
		await this.emailNotice(
			{
				organizationId: event.organizationId,
				noticeId: machineUnavailableNoticeKey(
					event.organizationId,
					event.machineId,
					event.unavailableSince
				),
			},
			EMAIL_CATEGORY.SANDBOX_NOTICE,
			{ roles: NOTICE_RECIPIENT_ROLES.SANDBOX },
			() =>
				machineUnavailableNoticeCopy({
					unavailableSince: event.unavailableSince,
					sandboxes: [first, ...rest],
				})
		);
	}

	private async queueMachineUnavailableNotice(
		sandboxId: string
	): Promise<void> {
		const sandbox = await this.entityManager.findOne(
			Sandbox,
			{ id: sandboxId, state: SandboxState.MACHINE_UNAVAILABLE },
			{ fields: ['organizationId', 'machineId'] }
		);
		if (!sandbox?.machineId) return;
		const machine = await this.entityManager.findOne(
			Machine,
			{ id: sandbox.machineId },
			{ fields: ['lastHealthyAt', 'createdAt'] }
		);
		if (!machine) return;
		await enqueueSandboxMachineUnavailableCheck(
			this.entityManager,
			{
				organizationId: sandbox.organizationId,
				machineId: machine.id,
				unavailableSince: (
					machine.lastHealthyAt ?? machine.createdAt
				).toISOString(),
			},
			SANDBOX_NOTICE_BATCH_SECONDS
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

	@OnEvent(SandboxEvents.PRICE_INCREASE_SCHEDULED)
	@IsolatedEntityManagerContext()
	async handleSandboxPriceIncreaseScheduled(
		event: SandboxPriceIncreaseScheduledEvent
	) {
		const dto = await this.currentSandboxDto(event.sandbox.id);
		this.notificationEmitter.emitSandboxPriceIncreaseScheduled(dto, event);
		const recipients = await organizationAdminEmails(
			this.entityManager,
			event.sandbox.organizationId
		);
		await settleSequentially(recipients, (recipient) =>
			this.email
				.sendPriceIncrease({
					placementPriceId: event.placementPriceId,
					recipient,
					sandboxName: dto.name,
					currentHourlyUsd: MicroUsd.parse(event.currentHourlyMicroUsd).toUsd(),
					newHourlyUsd: MicroUsd.parse(event.newHourlyMicroUsd).toUsd(),
					effectiveAt: event.priceIncreaseAt,
				})
				.catch((error: unknown) =>
					this.logger.error(
						`Could not email the price increase of placement price ${event.placementPriceId}`,
						error
					)
				)
		);
	}

	@OnEvent(FundingEvents.NOTICE)
	@IsolatedEntityManagerContext()
	async handleFundingNotice(event: FundingNoticeEvent) {
		this.notificationEmitter.emitFundingNotice(event);
		await this.emailNotice(
			event,
			EMAIL_CATEGORY.BILLING_NOTICE,
			{ roles: NOTICE_RECIPIENT_ROLES.CUSTOMER },
			(organizationName) => fundingNoticeCopy(organizationName, event.notice)
		);
	}

	@OnEvent(HostNoticeEvents.NOTICE)
	@IsolatedEntityManagerContext()
	async handleHostNotice(event: HostNoticeEvent) {
		await this.emailNotice(
			event,
			EMAIL_CATEGORY.HOST_NOTICE,
			{
				roles:
					HOST_NOTICE_RECIPIENT_ROLES[event.notice.kind] ??
					NOTICE_RECIPIENT_ROLES.HOST,
			},
			(organizationName) => hostNoticeCopy(organizationName, event.notice)
		);
	}

	@OnEvent(AbuseNoticeEvents.NOTICE)
	@IsolatedEntityManagerContext()
	async handleAbuseNotice(event: AbuseNoticeEvent) {
		await this.emailNotice(
			event,
			EMAIL_CATEGORY.ABUSE_NOTICE,
			{ roles: NOTICE_RECIPIENT_ROLES.ABUSE },
			(organizationName) => abuseNoticeCopy(organizationName, event.notice)
		);
	}

	@OnEvent(LimitsNoticeEvents.NOTICE)
	@IsolatedEntityManagerContext()
	async handleLimitsNotice(event: LimitsNoticeEvent) {
		const { notice } = event;
		await this.emailNotice(
			event,
			EMAIL_CATEGORY.LIMITS_NOTICE,
			notice.kind === LimitsNoticeKind.INCREASE_APPROVED ||
				notice.kind === LimitsNoticeKind.INCREASE_DENIED
				? {
						roles: NOTICE_RECIPIENT_ROLES.LIMITS_DECISION,
						userIds: notice.requesterUserId ? [notice.requesterUserId] : [],
					}
				: { roles: NOTICE_RECIPIENT_ROLES.LIMITS_TIER },
			(organizationName) => limitsNoticeCopy(organizationName, notice)
		);
	}

	@OnEvent(HostNoticeEvents.MACHINE_CHECK)
	@IsolatedEntityManagerContext()
	async handleMachineNoticeCheck(event: MachineNoticeCheckEvent) {
		const machine = await this.entityManager.findOne(
			Machine,
			{ id: event.machineId, state: event.state },
			{ fields: ['name', 'readinessReason'] }
		);
		if (!machine) return;
		const kind = MACHINE_NOTICE_KIND[event.state];
		const observedAt = await databaseNow(this.entityManager);
		const machineNotice = { machineId: machine.id, machineName: machine.name };
		await enqueueHostNotice(
			this.entityManager,
			new HostNoticeEvent(
				event.organizationId,
				cooldownNoticeKey(
					observedAt,
					NOTICE_COOLDOWN_SECONDS.machine,
					kind,
					machine.id
				),
				kind === HostNoticeKind.MACHINE_FAILED
					? { kind, ...machineNotice, reason: machine.readinessReason }
					: { kind, ...machineNotice },
				observedAt
			)
		);
	}

	@OnEvent(FundingEvents.API_KEY_BUDGET_EXHAUSTED)
	@IsolatedEntityManagerContext()
	async handleApiKeyBudgetExhausted(event: ApiKeyBudgetExhaustedEvent) {
		const apiKey = await this.entityManager.findOne(
			ApiKey,
			{ id: event.apiKeyId, referenceId: event.organizationId },
			{ fields: ['name', 'metadata'] }
		);
		if (!apiKey) return;
		const creatorId = apiKeyCreator(apiKey.metadata);
		await this.emailNotice(
			event,
			EMAIL_CATEGORY.BILLING_NOTICE,
			{
				roles: NOTICE_RECIPIENT_ROLES.API_KEY,
				userIds: creatorId ? [creatorId] : [],
			},
			(organizationName) =>
				apiKeyBudgetNoticeCopy(organizationName, apiKey.name, event)
		);
	}

	@OnEvent(MachineEvents.CHECK_FAILED)
	@IsolatedEntityManagerContext()
	async handleMachineCheckFailed(event: MachineCheckFailedEvent) {
		const failures = noticedMachineCheckFailures(event.failures);
		if (failures.length === 0) return;
		const machine = await this.entityManager.findOne(
			Machine,
			{ id: event.machineId, organizationId: event.organizationId },
			{ fields: ['name'] }
		);
		if (!machine) return;
		const kind = HostNoticeKind.MACHINE_CHECK_FAILED;
		await enqueueHostNotice(
			this.entityManager,
			new HostNoticeEvent(
				event.organizationId,
				cooldownNoticeKey(
					event.observedAt,
					NOTICE_COOLDOWN_SECONDS.machine,
					kind,
					machine.id,
					event.check,
					failures.join(NOTICE_KEY_LIST_SEPARATOR)
				),
				{
					kind,
					machineId: machine.id,
					machineName: machine.name,
					check: event.check,
					failures,
				},
				event.observedAt
			)
		);
	}

	private async emailNotice(
		event: Pick<FundingNoticeEvent, 'organizationId' | 'noticeId'>,
		category: NoticeEmailCategory,
		audience: NoticeAudience,
		copyFor: (organizationName: string) => NoticeCopy
	): Promise<void> {
		const organization = await this.entityManager.findOne(
			Organization,
			{ id: event.organizationId },
			{ fields: ['name'] }
		);
		if (!organization) return;
		const { action, ...copy } = copyFor(organization.name);
		const dashboardUrl = this.config.get('dashboardUrl');
		const link = dashboardUrl
			? {
					label: action.label,
					url: noticeUrl(dashboardUrl, event.organizationId, action),
				}
			: null;
		const recipients = await noticeRecipients(
			this.entityManager,
			event.organizationId,
			audience
		);
		await settleSequentially(recipients, (recipient) =>
			this.email
				.sendNotice({
					...copy,
					action: link,
					category,
					noticeId: event.noticeId,
					recipient,
				})
				.catch((error: unknown) =>
					this.logger.error(`Could not email notice ${event.noticeId}`, error)
				)
		);
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
	@IsolatedEntityManagerContext()
	async handleMachineStateUpdated(event: MachineStateUpdatedEvent) {
		this.notificationEmitter.emitMachineStateUpdated(
			event.machine,
			event.oldState,
			event.newState
		);
		const { id: machineId, organizationId } = event.machine;
		const state = event.newState;
		if (
			!organizationId ||
			state === event.oldState ||
			!isNoticedMachineState(state)
		) {
			return;
		}
		await enqueueMachineNoticeCheck(
			this.entityManager,
			{ organizationId, machineId, state },
			noticeKey(
				HostNoticeEvents.MACHINE_CHECK,
				machineId,
				state,
				(await databaseNow(this.entityManager)).getTime()
			),
			MACHINE_NOTICE_GRACE_SECONDS
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
