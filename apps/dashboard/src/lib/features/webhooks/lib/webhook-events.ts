/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	WebhookSubscribableEventType,
	type WebhookSubscribableEventType as WebhookSubscribableEventTypeValue,
} from '@snapflow/api-client';

export const WEBHOOK_EVENT_LABEL: Record<
	WebhookSubscribableEventTypeValue,
	string
> = {
	[WebhookSubscribableEventType.SandboxCreated]: 'Sandbox created',
	[WebhookSubscribableEventType.SandboxStarted]: 'Sandbox started',
	[WebhookSubscribableEventType.SandboxStopped]: 'Sandbox stopped',
	[WebhookSubscribableEventType.SandboxArchived]: 'Sandbox archived',
	[WebhookSubscribableEventType.SandboxDeleted]: 'Sandbox deleted',
	[WebhookSubscribableEventType.SandboxError]: 'Sandbox error',
	[WebhookSubscribableEventType.SandboxMachineUnavailable]:
		'Sandbox machine unavailable',
	[WebhookSubscribableEventType.SandboxPaused]: 'Sandbox paused',
	[WebhookSubscribableEventType.SandboxPausedForPayment]:
		'Sandbox paused for payment',
	[WebhookSubscribableEventType.SandboxPreempted]: 'Sandbox preempted',
	[WebhookSubscribableEventType.SandboxStateUpdated]: 'Sandbox state changed',
	[WebhookSubscribableEventType.SnapshotReady]: 'Snapshot ready',
	[WebhookSubscribableEventType.SnapshotFailed]: 'Snapshot failed',
	[WebhookSubscribableEventType.SnapshotDeleted]: 'Snapshot deleted',
	[WebhookSubscribableEventType.VolumeCreated]: 'Volume created',
	[WebhookSubscribableEventType.VolumeReady]: 'Volume ready',
	[WebhookSubscribableEventType.VolumeDeleted]: 'Volume deleted',
	[WebhookSubscribableEventType.VolumeError]: 'Volume error',
	[WebhookSubscribableEventType.BillingLowBalance]: 'Low balance',
	[WebhookSubscribableEventType.BillingSandboxesStoppedForFunds]:
		'Sandboxes stopped for funds',
	[WebhookSubscribableEventType.BillingAutoTopUpFailed]: 'Auto top-up failed',
	[WebhookSubscribableEventType.BillingArchiveDeletionScheduled]:
		'Archive deletion scheduled',
	[WebhookSubscribableEventType.BillingSignerExpiring]:
		'Spending signer expiring',
	[WebhookSubscribableEventType.BillingSignerExpired]:
		'Spending signer expired',
	[WebhookSubscribableEventType.BillingSignerRevoked]:
		'Spending signer revoked',
	[WebhookSubscribableEventType.UsageApiKeyBudgetExhausted]:
		'API key budget exhausted',
};

const EVENT_GROUP_SEPARATOR = '.';

const WEBHOOK_EVENT_GROUP_LABEL: Readonly<Record<string, string>> = {
	sandbox: 'Sandboxes',
	snapshot: 'Snapshots',
	volume: 'Volumes',
	billing: 'Billing',
	usage: 'Usage',
};

export const WEBHOOK_EVENT_TYPES: readonly WebhookSubscribableEventTypeValue[] =
	Object.values(WebhookSubscribableEventType);

export interface WebhookEventGroup {
	label: string;
	eventTypes: readonly WebhookSubscribableEventTypeValue[];
}

export const WEBHOOK_EVENT_GROUPS: readonly WebhookEventGroup[] =
	Object.entries(WEBHOOK_EVENT_GROUP_LABEL)
		.map(([prefix, label]) => ({
			label,
			eventTypes: WEBHOOK_EVENT_TYPES.filter((type) =>
				type.startsWith(`${prefix}${EVENT_GROUP_SEPARATOR}`)
			),
		}))
		.filter((group) => group.eventTypes.length > 0);

function isSubscribableEventType(
	type: string
): type is WebhookSubscribableEventTypeValue {
	return WEBHOOK_EVENT_TYPES.some((eventType) => eventType === type);
}

export function webhookEventLabel(type: string): string {
	return isSubscribableEventType(type) ? WEBHOOK_EVENT_LABEL[type] : type;
}
