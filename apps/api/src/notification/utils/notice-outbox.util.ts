/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { FundingEvents } from '../../billing/constants/funding.constants';
import type { ApiKeyBudgetExhaustedEvent } from '../../billing/events/api-key-budget-exhausted.event';
import type { FundingNoticeEvent } from '../../billing/events/funding-notice.event';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { addSeconds } from '../../common/utils/time.util';
import { MachineEvents } from '../../machine/constants/machine-events.constants';
import type { MachineCheckFailedEvent } from '../../machine/events/machine-check-failed.event';
import {
	LimitsNoticeEvents,
	QuotaTierEvents,
} from '../../organization/constants/organization-quota-tier.constants';
import type { LimitsNoticeEvent } from '../../organization/events/limits-notice.event';
import {
	AbuseNoticeEvents,
	HostNoticeEvents,
	NOTICE_KEY_SEPARATOR,
	SandboxNoticeEvents,
} from '../constants/notice.constants';
import { RealtimeOutboxDeduplication } from '../entities/realtime-outbox-deduplication.entity';
import { RealtimeOutboxEvent } from '../entities/realtime-outbox-event.entity';
import type { AbuseNoticeEvent } from '../events/abuse-notice.event';
import type { CounterNoticeForwardEvent } from '../events/counter-notice-forward.event';
import type { HostNoticeEvent } from '../events/host-notice.event';
import type {
	MachineNoticeCheckOutboxPayload,
	RealtimeOutboxPayload,
	SandboxMachineUnavailableCheckOutboxPayload,
} from '../types/realtime-outbox.types';

async function enqueue(
	manager: EntityManager,
	payload: RealtimeOutboxPayload & { organizationId: string },
	deduplicationKey: string,
	delaySeconds = 0
): Promise<void> {
	const claimed = await manager
		.createQueryBuilder(RealtimeOutboxDeduplication)
		.insert({ deduplicationKey })
		.onConflict(['deduplicationKey'])
		.ignore()
		.execute('run');
	if (claimed.affectedRows === 0) return;
	const event = new RealtimeOutboxEvent(payload, payload.organizationId);
	await manager
		.createQueryBuilder(RealtimeOutboxEvent)
		.insert({
			...event,
			deduplicationKey,
			availableAt: addSeconds(event.availableAt, delaySeconds),
		})
		.onConflict(['deduplicationKey'])
		.ignore()
		.execute('run');
}

export function noticeKey(...parts: readonly (string | number)[]): string {
	return parts.join(NOTICE_KEY_SEPARATOR);
}

export function cooldownNoticeKey(
	at: Date,
	cooldownSeconds: number,
	...parts: readonly string[]
): string {
	return noticeKey(
		...parts,
		Math.floor(at.getTime() / (cooldownSeconds * MILLISECONDS_PER_SECOND))
	);
}

export function enqueueFundingNotice(
	manager: EntityManager,
	event: FundingNoticeEvent
): Promise<void> {
	return enqueue(
		manager,
		{
			topic: FundingEvents.NOTICE,
			organizationId: event.organizationId,
			noticeId: event.noticeId,
			notice: event.notice,
			observedAt: event.observedAt.toISOString(),
		},
		event.noticeId
	);
}

export function enqueueHostNotice(
	manager: EntityManager,
	event: HostNoticeEvent
): Promise<void> {
	return enqueue(
		manager,
		{
			topic: HostNoticeEvents.NOTICE,
			organizationId: event.organizationId,
			noticeId: event.noticeId,
			notice: event.notice,
			observedAt: event.observedAt.toISOString(),
		},
		event.noticeId
	);
}

export function enqueueAbuseNotice(
	manager: EntityManager,
	event: AbuseNoticeEvent
): Promise<void> {
	return enqueue(
		manager,
		{
			topic: AbuseNoticeEvents.NOTICE,
			organizationId: event.organizationId,
			noticeId: event.noticeId,
			notice: event.notice,
			observedAt: event.observedAt.toISOString(),
		},
		event.noticeId
	);
}

export function enqueueCounterNoticeForward(
	manager: EntityManager,
	event: CounterNoticeForwardEvent
): Promise<void> {
	return enqueue(
		manager,
		{ ...event, topic: AbuseNoticeEvents.FORWARD_COUNTER_NOTICE },
		noticeKey(AbuseNoticeEvents.FORWARD_COUNTER_NOTICE, event.reportId)
	);
}

export function enqueueApiKeyBudgetExhausted(
	manager: EntityManager,
	event: ApiKeyBudgetExhaustedEvent
): Promise<void> {
	return enqueue(
		manager,
		{
			...event,
			topic: FundingEvents.API_KEY_BUDGET_EXHAUSTED,
			observedAt: event.observedAt.toISOString(),
		},
		event.noticeId
	);
}

export function enqueueMachineCheckFailed(
	manager: EntityManager,
	event: MachineCheckFailedEvent,
	deduplicationKey: string
): Promise<void> {
	return enqueue(
		manager,
		{
			...event,
			topic: MachineEvents.CHECK_FAILED,
			observedAt: event.observedAt.toISOString(),
		},
		deduplicationKey
	);
}

export function enqueueMachineNoticeCheck(
	manager: EntityManager,
	payload: Omit<MachineNoticeCheckOutboxPayload, 'topic'>,
	deduplicationKey: string,
	delaySeconds: number
): Promise<void> {
	return enqueue(
		manager,
		{ topic: HostNoticeEvents.MACHINE_CHECK, ...payload },
		deduplicationKey,
		delaySeconds
	);
}

export function machineUnavailableNoticeKey(
	organizationId: string,
	machineId: string,
	unavailableSince: Date
): string {
	return noticeKey(
		SandboxNoticeEvents.MACHINE_UNAVAILABLE_CHECK,
		organizationId,
		machineId,
		unavailableSince.getTime()
	);
}

export function enqueueSandboxMachineUnavailableCheck(
	manager: EntityManager,
	payload: Omit<SandboxMachineUnavailableCheckOutboxPayload, 'topic'>,
	delaySeconds: number
): Promise<void> {
	return enqueue(
		manager,
		{ topic: SandboxNoticeEvents.MACHINE_UNAVAILABLE_CHECK, ...payload },
		machineUnavailableNoticeKey(
			payload.organizationId,
			payload.machineId,
			new Date(payload.unavailableSince)
		),
		delaySeconds
	);
}

export function enqueueLimitsNotice(
	manager: EntityManager,
	event: LimitsNoticeEvent
): Promise<void> {
	return enqueue(
		manager,
		{
			topic: LimitsNoticeEvents.NOTICE,
			organizationId: event.organizationId,
			noticeId: event.noticeId,
			notice: event.notice,
			observedAt: event.observedAt.toISOString(),
		},
		event.noticeId
	);
}

export function enqueueQuotaTierEvaluation(
	manager: EntityManager,
	organizationId: string,
	deduplicationKey: string
): Promise<void> {
	return enqueue(
		manager,
		{ topic: QuotaTierEvents.EVALUATE, organizationId },
		deduplicationKey
	);
}
