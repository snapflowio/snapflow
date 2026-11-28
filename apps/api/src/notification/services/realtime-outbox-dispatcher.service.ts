/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FundingEvents } from '../../billing/constants/funding.constants';
import { ApiKeyBudgetExhaustedEvent } from '../../billing/events/api-key-budget-exhausted.event';
import { FundingNoticeEvent } from '../../billing/events/funding-notice.event';
import { errorMessage, errorStack } from '../../common/utils/error/error.util';
import { addSeconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { MachineEvents } from '../../machine/constants/machine-events.constants';
import { MachineCheckFailedEvent } from '../../machine/events/machine-check-failed.event';
import { MachineCreatedEvent } from '../../machine/events/machine-created.event';
import { MachineStateUpdatedEvent } from '../../machine/events/machine-state-updated.event';
import { MachineUnschedulableUpdatedEvent } from '../../machine/events/machine-unschedulable-updated.event';
import {
	LimitsNoticeEvents,
	QuotaTierEvents,
} from '../../organization/constants/organization-quota-tier.constants';
import { LimitsNoticeEvent } from '../../organization/events/limits-notice.event';
import { QuotaTierEvaluationEvent } from '../../organization/events/quota-tier-evaluation.event';
import { VolumeEvents } from '../../volume/constants/volume-events.constants';
import { VolumeCreatedEvent } from '../../volume/events/volume-created.event';
import { VolumeLastUsedAtUpdatedEvent } from '../../volume/events/volume-last-used-at-updated.event';
import { VolumeStateUpdatedEvent } from '../../volume/events/volume-state-updated.event';
import {
	AbuseNoticeEvents,
	HostNoticeEvents,
	SandboxNoticeEvents,
} from '../constants/notice.constants';
import {
	REALTIME_OUTBOX,
	RealtimeOutboxStatus,
} from '../constants/realtime-outbox.constants';
import { RealtimeOutboxEvent } from '../entities/realtime-outbox-event.entity';
import { AbuseNoticeEvent } from '../events/abuse-notice.event';
import { CounterNoticeForwardEvent } from '../events/counter-notice-forward.event';
import { HostNoticeEvent } from '../events/host-notice.event';
import { MachineNoticeCheckEvent } from '../events/machine-notice-check.event';
import { SandboxMachineUnavailableCheckEvent } from '../events/sandbox-machine-unavailable-check.event';
import type { RealtimeOutboxPayload } from '../types/realtime-outbox.types';

interface ClaimedOutboxEvent {
	id: string;
	attempts: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertApiKeyBudgetPayload(payload: Record<string, unknown>): void {
	if (
		typeof payload.organizationId !== 'string' ||
		typeof payload.noticeId !== 'string' ||
		typeof payload.apiKeyId !== 'string' ||
		typeof payload.computeSpendLimitMicroUsd !== 'string' ||
		typeof payload.stoppedSandboxes !== 'number' ||
		typeof payload.observedAt !== 'string'
	) {
		throw new Error('API key budget event is incomplete');
	}
}

function assertMachineCheckPayload(payload: Record<string, unknown>): void {
	if (
		typeof payload.organizationId !== 'string' ||
		typeof payload.machineId !== 'string' ||
		typeof payload.check !== 'string' ||
		!Array.isArray(payload.failures) ||
		typeof payload.observedAt !== 'string'
	) {
		throw new Error('Machine check event is incomplete');
	}
}

function assertMachineNoticeCheckPayload(
	payload: Record<string, unknown>
): void {
	if (
		typeof payload.organizationId !== 'string' ||
		typeof payload.machineId !== 'string' ||
		typeof payload.state !== 'string'
	) {
		throw new Error('Machine notice check is incomplete');
	}
}

function assertMachineUnavailableCheckPayload(
	payload: Record<string, unknown>
): void {
	if (
		typeof payload.organizationId !== 'string' ||
		typeof payload.machineId !== 'string' ||
		typeof payload.unavailableSince !== 'string'
	) {
		throw new Error('Sandbox machine-unavailable check is incomplete');
	}
}

function assertRealtimeOutboxPayload(
	payload: object
): asserts payload is RealtimeOutboxPayload {
	if (!isRecord(payload) || typeof payload.topic !== 'string') {
		throw new Error('Realtime outbox payload has no event topic');
	}

	switch (payload.topic) {
		case MachineEvents.CREATED:
		case MachineEvents.STATE_UPDATED:
		case MachineEvents.UNSCHEDULABLE_UPDATED:
			if (!isRecord(payload.machine)) {
				throw new Error('Realtime machine event has no machine payload');
			}
			return;
		case VolumeEvents.CREATED:
		case VolumeEvents.STATE_UPDATED:
		case VolumeEvents.LAST_USED_AT_UPDATED:
			if (!isRecord(payload.volume)) {
				throw new Error('Realtime volume event has no volume payload');
			}
			return;
		case FundingEvents.NOTICE:
		case HostNoticeEvents.NOTICE:
		case AbuseNoticeEvents.NOTICE:
		case LimitsNoticeEvents.NOTICE:
			if (
				!isRecord(payload.notice) ||
				typeof payload.organizationId !== 'string' ||
				typeof payload.noticeId !== 'string' ||
				typeof payload.observedAt !== 'string'
			) {
				throw new Error('Notice outbox event is incomplete');
			}
			return;
		case SandboxNoticeEvents.MACHINE_UNAVAILABLE_CHECK:
			assertMachineUnavailableCheckPayload(payload);
			return;
		case HostNoticeEvents.MACHINE_CHECK:
			assertMachineNoticeCheckPayload(payload);
			return;
		case QuotaTierEvents.EVALUATE:
			if (typeof payload.organizationId !== 'string') {
				throw new Error('Quota tier evaluation has no organization');
			}
			return;
		case FundingEvents.API_KEY_BUDGET_EXHAUSTED:
			assertApiKeyBudgetPayload(payload);
			return;
		case MachineEvents.CHECK_FAILED:
			assertMachineCheckPayload(payload);
			return;
		case AbuseNoticeEvents.FORWARD_COUNTER_NOTICE:
			if (
				typeof payload.organizationId !== 'string' ||
				typeof payload.reportId !== 'string'
			) {
				throw new Error('Counter-notice forward event is incomplete');
			}
			return;
		default:
			throw new Error(`Unsupported realtime outbox topic: ${payload.topic}`);
	}
}

@Injectable()
export class RealtimeOutboxDispatcherService {
	private readonly logger = new Logger(RealtimeOutboxDispatcherService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly eventEmitter: EventEmitter2
	) {}

	async dispatch(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const lockId = randomUUID();
			const claimed = await this.claim(lockId);

			for (const event of claimed) {
				await this.dispatchOne(event, lockId);
			}
		});
	}

	private claim(lockId: string): Promise<ClaimedOutboxEvent[]> {
		return this.entityManager.execute<ClaimedOutboxEvent[]>(
			`WITH candidates AS (
				SELECT id
				FROM realtime_outbox_event
				WHERE attempts < ?
				  AND "availableAt" <= transaction_timestamp()
				  AND (
					status = ?
					OR (
						status = ?
						AND "lockedUntil" <= transaction_timestamp()
					)
				  )
				ORDER BY "createdAt" ASC, id ASC
				FOR UPDATE SKIP LOCKED
				LIMIT ?
			)
			UPDATE realtime_outbox_event AS event
			SET status = ?,
				attempts = event.attempts + 1,
				"lockId" = ?,
				"lockedUntil" = transaction_timestamp() + make_interval(secs => ?),
				"updatedAt" = transaction_timestamp()
			FROM candidates
			WHERE event.id = candidates.id
			RETURNING event.id, event.attempts`,
			[
				REALTIME_OUTBOX.maximumAttempts,
				RealtimeOutboxStatus.PENDING,
				RealtimeOutboxStatus.PROCESSING,
				REALTIME_OUTBOX.batchSize,
				RealtimeOutboxStatus.PROCESSING,
				lockId,
				REALTIME_OUTBOX.claimSeconds,
			]
		);
	}

	private async dispatchOne(
		claimed: ClaimedOutboxEvent,
		lockId: string
	): Promise<void> {
		try {
			const outboxEvent = await this.entityManager.findOne(
				RealtimeOutboxEvent,
				{
					id: claimed.id,
					lockId,
					status: RealtimeOutboxStatus.PROCESSING,
				}
			);
			if (!outboxEvent) return;

			await this.publish(outboxEvent.payload);
			const publishedAt = await databaseNow(this.entityManager);
			await this.entityManager.nativeUpdate(
				RealtimeOutboxEvent,
				{
					id: claimed.id,
					lockId,
					status: RealtimeOutboxStatus.PROCESSING,
				},
				{
					status: RealtimeOutboxStatus.PUBLISHED,
					publishedAt,
					lockId: null,
					lockedUntil: null,
					lastError: null,
					updatedAt: publishedAt,
				}
			);
		} catch (error) {
			await this.releaseAfterFailure(claimed, lockId, error);
			this.logger.error(
				`Realtime outbox event ${claimed.id} failed: ${errorMessage(error)}`,
				errorStack(error)
			);
		}
	}

	private async publish(payload: object): Promise<void> {
		assertRealtimeOutboxPayload(payload);
		switch (payload.topic) {
			case MachineEvents.CREATED:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new MachineCreatedEvent(payload.machine)
				);
				return;
			case MachineEvents.STATE_UPDATED:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new MachineStateUpdatedEvent(
						payload.machine,
						payload.oldState,
						payload.newState
					)
				);
				return;
			case MachineEvents.UNSCHEDULABLE_UPDATED:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new MachineUnschedulableUpdatedEvent(
						payload.machine,
						payload.oldUnschedulable,
						payload.newUnschedulable
					)
				);
				return;
			case VolumeEvents.CREATED:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new VolumeCreatedEvent(payload.volume)
				);
				return;
			case VolumeEvents.STATE_UPDATED:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new VolumeStateUpdatedEvent(
						payload.volume,
						payload.oldState,
						payload.newState
					)
				);
				return;
			case VolumeEvents.LAST_USED_AT_UPDATED:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new VolumeLastUsedAtUpdatedEvent(payload.volume)
				);
				return;
			case FundingEvents.NOTICE:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new FundingNoticeEvent(
						payload.organizationId,
						payload.noticeId,
						payload.notice,
						new Date(payload.observedAt)
					)
				);
				return;
			case HostNoticeEvents.NOTICE:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new HostNoticeEvent(
						payload.organizationId,
						payload.noticeId,
						payload.notice,
						new Date(payload.observedAt)
					)
				);
				return;
			case AbuseNoticeEvents.NOTICE:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new AbuseNoticeEvent(
						payload.organizationId,
						payload.noticeId,
						payload.notice,
						new Date(payload.observedAt)
					)
				);
				return;
			case LimitsNoticeEvents.NOTICE:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new LimitsNoticeEvent(
						payload.organizationId,
						payload.noticeId,
						payload.notice,
						new Date(payload.observedAt)
					)
				);
				return;
			case QuotaTierEvents.EVALUATE:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new QuotaTierEvaluationEvent(payload.organizationId)
				);
				return;
			case SandboxNoticeEvents.MACHINE_UNAVAILABLE_CHECK:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new SandboxMachineUnavailableCheckEvent(
						payload.organizationId,
						payload.machineId,
						new Date(payload.unavailableSince)
					)
				);
				return;
			case HostNoticeEvents.MACHINE_CHECK:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new MachineNoticeCheckEvent(
						payload.organizationId,
						payload.machineId,
						payload.state
					)
				);
				return;
			case FundingEvents.API_KEY_BUDGET_EXHAUSTED:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new ApiKeyBudgetExhaustedEvent(
						payload.organizationId,
						payload.noticeId,
						payload.apiKeyId,
						payload.computeSpendLimitMicroUsd,
						payload.stoppedSandboxes,
						new Date(payload.observedAt)
					)
				);
				return;
			case MachineEvents.CHECK_FAILED:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new MachineCheckFailedEvent(
						payload.organizationId,
						payload.machineId,
						payload.check,
						payload.failures,
						new Date(payload.observedAt)
					)
				);
				return;
			case AbuseNoticeEvents.FORWARD_COUNTER_NOTICE:
				await this.eventEmitter.emitAsync(
					payload.topic,
					new CounterNoticeForwardEvent(
						payload.organizationId,
						payload.reportId
					)
				);
		}
	}

	private async releaseAfterFailure(
		claimed: ClaimedOutboxEvent,
		lockId: string,
		error: unknown
	): Promise<void> {
		const exhausted = claimed.attempts >= REALTIME_OUTBOX.maximumAttempts;
		const backoffSeconds = Math.min(
			REALTIME_OUTBOX.maximumBackoffSeconds,
			REALTIME_OUTBOX.backoffBaseSeconds ** claimed.attempts
		);
		const now = await databaseNow(this.entityManager);
		const availableAt = addSeconds(now, backoffSeconds);

		await this.entityManager.nativeUpdate(
			RealtimeOutboxEvent,
			{
				id: claimed.id,
				lockId,
				status: RealtimeOutboxStatus.PROCESSING,
			},
			{
				status: exhausted
					? RealtimeOutboxStatus.FAILED
					: RealtimeOutboxStatus.PENDING,
				availableAt,
				lockId: null,
				lockedUntil: null,
				lastError: errorMessage(error).slice(
					0,
					REALTIME_OUTBOX.maximumStoredErrorLength
				),
				updatedAt: now,
			}
		);
	}
}
