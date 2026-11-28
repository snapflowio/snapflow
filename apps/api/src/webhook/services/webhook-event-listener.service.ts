/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { FundingEvents } from '../../billing/constants/funding.constants';
import type { ApiKeyBudgetExhaustedEvent } from '../../billing/events/api-key-budget-exhausted.event';
import type { FundingNoticeEvent } from '../../billing/events/funding-notice.event';
import { OnAsyncEvent } from '../../common/decorators/on-async-event.decorator';
import { VolumeEvents } from '../../volume/constants/volume-events.constants';
import type { VolumeCreatedEvent } from '../../volume/events/volume-created.event';
import type { VolumeStateUpdatedEvent } from '../../volume/events/volume-state-updated.event';
import {
	FUNDING_NOTICE_WEBHOOK_EVENT,
	WEBHOOK_DEDUPLICATION_SEPARATOR,
} from '../constants/webhook-event-mapping.constants';
import { WebhookEventType } from '../enums/webhook-event-type.enum';
import type { WebhookPublication } from '../types/webhook-payload.types';
import {
	volumeCreatedWebhook,
	volumeStateWebhook,
} from '../utils/domain-webhook.util';
import { WebhookPublisherService } from './webhook-publisher.service';

function deduplicationKey(...parts: readonly string[]): string {
	return parts.join(WEBHOOK_DEDUPLICATION_SEPARATOR);
}

@Injectable()
export class WebhookEventListenerService {
	constructor(private readonly publisher: WebhookPublisherService) {}

	@OnAsyncEvent({ event: VolumeEvents.CREATED })
	handleVolumeCreated(event: VolumeCreatedEvent): Promise<void> {
		return this.publishIfAny(volumeCreatedWebhook(event.volume));
	}

	@OnAsyncEvent({ event: VolumeEvents.STATE_UPDATED })
	handleVolumeStateUpdated(event: VolumeStateUpdatedEvent): Promise<void> {
		return this.publishIfAny(volumeStateWebhook(event.volume, event.oldState));
	}

	@OnAsyncEvent({ event: FundingEvents.NOTICE })
	async handleFundingNotice(event: FundingNoticeEvent): Promise<void> {
		const { kind, ...details } = event.notice;
		const type = FUNDING_NOTICE_WEBHOOK_EVENT[kind];
		await this.publisher.publish({
			organizationId: event.organizationId,
			type,
			data: {
				noticeId: event.noticeId,
				organizationId: event.organizationId,
				observedAt: event.observedAt.toISOString(),
				...details,
			},
			deduplicationKey: deduplicationKey(type, event.noticeId),
		});
	}

	@OnAsyncEvent({ event: FundingEvents.API_KEY_BUDGET_EXHAUSTED })
	async handleApiKeyBudgetExhausted(
		event: ApiKeyBudgetExhaustedEvent
	): Promise<void> {
		const type = WebhookEventType.USAGE_API_KEY_BUDGET_EXHAUSTED;
		await this.publisher.publish({
			organizationId: event.organizationId,
			type,
			data: {
				apiKeyId: event.apiKeyId,
				organizationId: event.organizationId,
				computeSpendLimitMicroUsd: event.computeSpendLimitMicroUsd,
				stoppedSandboxes: event.stoppedSandboxes,
				observedAt: event.observedAt.toISOString(),
			},
			deduplicationKey: deduplicationKey(type, event.noticeId),
		});
	}

	private async publishIfAny(
		publication: WebhookPublication | null
	): Promise<void> {
		if (publication) await this.publisher.publish(publication);
	}
}
