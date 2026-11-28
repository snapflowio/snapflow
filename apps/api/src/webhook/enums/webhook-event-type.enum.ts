/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum WebhookEventType {
	SANDBOX_CREATED = 'sandbox.created',
	SANDBOX_STARTED = 'sandbox.started',
	SANDBOX_STOPPED = 'sandbox.stopped',
	SANDBOX_ARCHIVED = 'sandbox.archived',
	SANDBOX_DELETED = 'sandbox.deleted',
	SANDBOX_ERROR = 'sandbox.error',
	SANDBOX_MACHINE_UNAVAILABLE = 'sandbox.machine_unavailable',
	SANDBOX_PAUSED = 'sandbox.paused',
	SANDBOX_PAUSED_FOR_PAYMENT = 'sandbox.paused_for_payment',
	SANDBOX_PREEMPTED = 'sandbox.preempted',
	SANDBOX_STATE_UPDATED = 'sandbox.state_updated',
	SNAPSHOT_READY = 'snapshot.ready',
	SNAPSHOT_FAILED = 'snapshot.failed',
	SNAPSHOT_DELETED = 'snapshot.deleted',
	VOLUME_CREATED = 'volume.created',
	VOLUME_READY = 'volume.ready',
	VOLUME_DELETED = 'volume.deleted',
	VOLUME_ERROR = 'volume.error',
	BILLING_LOW_BALANCE = 'billing.low_balance',
	BILLING_SANDBOXES_STOPPED_FOR_FUNDS = 'billing.sandboxes_stopped_for_funds',
	BILLING_AUTO_TOP_UP_FAILED = 'billing.auto_top_up_failed',
	BILLING_ARCHIVE_DELETION_SCHEDULED = 'billing.archive_deletion_scheduled',
	BILLING_SIGNER_EXPIRING = 'billing.signer_expiring',
	BILLING_SIGNER_EXPIRED = 'billing.signer_expired',
	BILLING_SIGNER_REVOKED = 'billing.signer_revoked',
	USAGE_API_KEY_BUDGET_EXHAUSTED = 'usage.api_key_budget_exhausted',
	WEBHOOK_TEST = 'webhook.test',
}

export type SubscribableWebhookEventType = Exclude<
	WebhookEventType,
	WebhookEventType.WEBHOOK_TEST
>;

export const SUBSCRIBABLE_WEBHOOK_EVENT_TYPES: readonly SubscribableWebhookEventType[] =
	Object.values(WebhookEventType).filter(
		(type): type is SubscribableWebhookEventType =>
			type !== WebhookEventType.WEBHOOK_TEST
	);
