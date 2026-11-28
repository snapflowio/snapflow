/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { FundingNoticeKind } from '../../billing/constants/funding.constants';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { SnapshotState } from '../../snapshot/enums/snapshot-state.enum';
import { VolumeState } from '../../volume/enums/volume-state.enum';
import { WebhookEventType } from '../enums/webhook-event-type.enum';

export const SANDBOX_STATE_WEBHOOK_EVENT: Partial<
	Record<SandboxState, WebhookEventType>
> = {
	[SandboxState.STARTED]: WebhookEventType.SANDBOX_STARTED,
	[SandboxState.STOPPED]: WebhookEventType.SANDBOX_STOPPED,
	[SandboxState.PAUSED]: WebhookEventType.SANDBOX_PAUSED,
	[SandboxState.ARCHIVED]: WebhookEventType.SANDBOX_ARCHIVED,
	[SandboxState.DESTROYED]: WebhookEventType.SANDBOX_DELETED,
	[SandboxState.ERROR]: WebhookEventType.SANDBOX_ERROR,
	[SandboxState.BUILD_FAILED]: WebhookEventType.SANDBOX_ERROR,
	[SandboxState.MACHINE_UNAVAILABLE]:
		WebhookEventType.SANDBOX_MACHINE_UNAVAILABLE,
};

export const SNAPSHOT_STATE_WEBHOOK_EVENT: Partial<
	Record<SnapshotState, WebhookEventType>
> = {
	[SnapshotState.ACTIVE]: WebhookEventType.SNAPSHOT_READY,
	[SnapshotState.ERROR]: WebhookEventType.SNAPSHOT_FAILED,
	[SnapshotState.BUILD_FAILED]: WebhookEventType.SNAPSHOT_FAILED,
};

export const VOLUME_STATE_WEBHOOK_EVENT: Partial<
	Record<VolumeState, WebhookEventType>
> = {
	[VolumeState.READY]: WebhookEventType.VOLUME_READY,
	[VolumeState.DELETED]: WebhookEventType.VOLUME_DELETED,
	[VolumeState.ERROR]: WebhookEventType.VOLUME_ERROR,
};

export const FUNDING_NOTICE_WEBHOOK_EVENT: Record<
	FundingNoticeKind,
	WebhookEventType
> = {
	[FundingNoticeKind.RUNWAY_WARNING]: WebhookEventType.BILLING_LOW_BALANCE,
	[FundingNoticeKind.COMPUTE_STOPPED]:
		WebhookEventType.BILLING_SANDBOXES_STOPPED_FOR_FUNDS,
	[FundingNoticeKind.ARCHIVE_DELETION_SCHEDULED]:
		WebhookEventType.BILLING_ARCHIVE_DELETION_SCHEDULED,
	[FundingNoticeKind.AUTO_TOP_UP_FAILED]:
		WebhookEventType.BILLING_AUTO_TOP_UP_FAILED,
	[FundingNoticeKind.SIGNER_EXPIRING]: WebhookEventType.BILLING_SIGNER_EXPIRING,
	[FundingNoticeKind.SIGNER_EXPIRED]: WebhookEventType.BILLING_SIGNER_EXPIRED,
	[FundingNoticeKind.SIGNER_REVOKED]: WebhookEventType.BILLING_SIGNER_REVOKED,
	[FundingNoticeKind.SANDBOX_PAUSED_FOR_PAYMENT]:
		WebhookEventType.SANDBOX_PAUSED_FOR_PAYMENT,
};

export const WEBHOOK_DEDUPLICATION_SEPARATOR = ':';
