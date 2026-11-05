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
import { errorMessage, errorStack } from '../../common/utils/error/error.util';
import { addSeconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { MachineEvents } from '../../machine/constants/machine-events.constants';
import { MachineCreatedEvent } from '../../machine/events/machine-created.event';
import { MachineStateUpdatedEvent } from '../../machine/events/machine-state-updated.event';
import { MachineUnschedulableUpdatedEvent } from '../../machine/events/machine-unschedulable-updated.event';
import { VolumeEvents } from '../../volume/constants/volume-events.constants';
import { VolumeCreatedEvent } from '../../volume/events/volume-created.event';
import { VolumeLastUsedAtUpdatedEvent } from '../../volume/events/volume-last-used-at-updated.event';
import { VolumeStateUpdatedEvent } from '../../volume/events/volume-state-updated.event';
import {
	REALTIME_OUTBOX,
	RealtimeOutboxStatus,
} from '../constants/realtime-outbox.constants';
import { RealtimeOutboxEvent } from '../entities/realtime-outbox-event.entity';
import type { RealtimeOutboxPayload } from '../types/realtime-outbox.types';

interface ClaimedOutboxEvent {
	id: string;
	attempts: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
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
