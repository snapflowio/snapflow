/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FundingEvents } from '../../billing/constants/funding.constants';
import type { ApiKeyBudgetExhaustedEvent } from '../../billing/events/api-key-budget-exhausted.event';
import type { FundingNotice } from '../../billing/events/funding-notice.event';
import type { MachineEvents } from '../../machine/constants/machine-events.constants';
import type { MachineDto } from '../../machine/dto/machine.dto';
import type { MachineState } from '../../machine/enums/machine-state.enum';
import type { MachineCheckFailedEvent } from '../../machine/events/machine-check-failed.event';
import type {
	LimitsNoticeEvents,
	QuotaTierEvents,
} from '../../organization/constants/organization-quota-tier.constants';
import type { LimitsNotice } from '../../organization/events/limits-notice.event';
import type { VolumeEvents } from '../../volume/constants/volume-events.constants';
import type { VolumeDto } from '../../volume/dto/volume.dto';
import type { VolumeState } from '../../volume/enums/volume-state.enum';
import type {
	AbuseNoticeEvents,
	HostNoticeEvents,
	NoticedMachineState,
	SandboxNoticeEvents,
} from '../constants/notice.constants';
import type { AbuseNotice } from '../events/abuse-notice.event';
import type { CounterNoticeForwardEvent } from '../events/counter-notice-forward.event';
import type { HostNotice } from '../events/host-notice.event';

interface NoticeOutboxPayload<Topic extends string, Notice> {
	topic: Topic;
	organizationId: string;
	noticeId: string;
	notice: Notice;
	observedAt: string;
}

type FundingNoticeOutboxPayload = NoticeOutboxPayload<
	typeof FundingEvents.NOTICE,
	FundingNotice
>;

type HostNoticeOutboxPayload = NoticeOutboxPayload<
	typeof HostNoticeEvents.NOTICE,
	HostNotice
>;

type AbuseNoticeOutboxPayload = NoticeOutboxPayload<
	typeof AbuseNoticeEvents.NOTICE,
	AbuseNotice
>;

type LimitsNoticeOutboxPayload = NoticeOutboxPayload<
	typeof LimitsNoticeEvents.NOTICE,
	LimitsNotice
>;

interface QuotaTierEvaluationOutboxPayload {
	topic: typeof QuotaTierEvents.EVALUATE;
	organizationId: string;
}

export interface MachineNoticeCheckOutboxPayload {
	topic: typeof HostNoticeEvents.MACHINE_CHECK;
	organizationId: string;
	machineId: string;
	state: NoticedMachineState;
}

export interface SandboxMachineUnavailableCheckOutboxPayload {
	topic: typeof SandboxNoticeEvents.MACHINE_UNAVAILABLE_CHECK;
	organizationId: string;
	machineId: string;
	unavailableSince: string;
}

export type CounterNoticeForwardOutboxPayload = {
	topic: typeof AbuseNoticeEvents.FORWARD_COUNTER_NOTICE;
} & CounterNoticeForwardEvent;

type ObservedOutboxPayload<Topic extends string, Event extends object> = {
	topic: Topic;
	observedAt: string;
} & Omit<Event, 'observedAt'>;

type ApiKeyBudgetExhaustedOutboxPayload = ObservedOutboxPayload<
	typeof FundingEvents.API_KEY_BUDGET_EXHAUSTED,
	ApiKeyBudgetExhaustedEvent
>;

type MachineCheckFailedOutboxPayload = ObservedOutboxPayload<
	typeof MachineEvents.CHECK_FAILED,
	MachineCheckFailedEvent
>;

export type RealtimeOutboxPayload =
	| {
			topic: typeof MachineEvents.CREATED;
			machine: MachineDto;
	  }
	| {
			topic: typeof MachineEvents.STATE_UPDATED;
			machine: MachineDto;
			oldState: MachineState;
			newState: MachineState;
	  }
	| {
			topic: typeof MachineEvents.UNSCHEDULABLE_UPDATED;
			machine: MachineDto;
			oldUnschedulable: boolean;
			newUnschedulable: boolean;
	  }
	| {
			topic: typeof VolumeEvents.CREATED;
			volume: VolumeDto;
	  }
	| {
			topic: typeof VolumeEvents.STATE_UPDATED;
			volume: VolumeDto;
			oldState: VolumeState;
			newState: VolumeState;
	  }
	| {
			topic: typeof VolumeEvents.LAST_USED_AT_UPDATED;
			volume: VolumeDto;
	  }
	| FundingNoticeOutboxPayload
	| HostNoticeOutboxPayload
	| AbuseNoticeOutboxPayload
	| MachineNoticeCheckOutboxPayload
	| SandboxMachineUnavailableCheckOutboxPayload
	| LimitsNoticeOutboxPayload
	| QuotaTierEvaluationOutboxPayload
	| ApiKeyBudgetExhaustedOutboxPayload
	| MachineCheckFailedOutboxPayload
	| CounterNoticeForwardOutboxPayload;
