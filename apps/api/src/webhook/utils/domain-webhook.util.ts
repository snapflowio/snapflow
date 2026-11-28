/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import type { Snapshot } from '../../snapshot/entities/snapshot.entity';
import type { VolumeDto } from '../../volume/dto/volume.dto';
import {
	SANDBOX_STATE_WEBHOOK_EVENT,
	SNAPSHOT_STATE_WEBHOOK_EVENT,
	VOLUME_STATE_WEBHOOK_EVENT,
	WEBHOOK_DEDUPLICATION_SEPARATOR,
} from '../constants/webhook-event-mapping.constants';
import { WebhookEventType } from '../enums/webhook-event-type.enum';
import type { WebhookPublication } from '../types/webhook-payload.types';

type SandboxWebhookFields = Pick<
	Sandbox,
	'id' | 'organizationId' | 'name' | 'state' | 'errorReason' | 'updatedAt'
>;

type SnapshotWebhookFields = Pick<
	Snapshot,
	'id' | 'organizationId' | 'name' | 'state' | 'errorReason' | 'updatedAt'
>;

const ONCE_PER_RESOURCE_EVENTS: ReadonlySet<WebhookEventType> = new Set([
	WebhookEventType.SANDBOX_CREATED,
	WebhookEventType.SANDBOX_DELETED,
	WebhookEventType.SNAPSHOT_DELETED,
	WebhookEventType.VOLUME_CREATED,
	WebhookEventType.VOLUME_DELETED,
]);

function deduplicationKey(
	type: WebhookEventType,
	resourceId: string,
	occurrence: string
): string {
	const parts = ONCE_PER_RESOURCE_EVENTS.has(type)
		? [type, resourceId]
		: [type, resourceId, occurrence];
	return parts.join(WEBHOOK_DEDUPLICATION_SEPARATOR);
}

export function sandboxCreatedWebhook(sandbox: Sandbox): WebhookPublication {
	const type = WebhookEventType.SANDBOX_CREATED;
	return {
		organizationId: sandbox.organizationId,
		type,
		data: {
			sandboxId: sandbox.id,
			organizationId: sandbox.organizationId,
			name: sandbox.name,
			sandboxClass: sandbox.sandboxClass,
			snapshot: sandbox.snapshot ?? null,
			state: sandbox.state,
			cpu: sandbox.cpu,
			memoryGib: sandbox.mem,
			diskGib: sandbox.disk,
			gpu: sandbox.gpu,
			createdAt: sandbox.createdAt.toISOString(),
		},
		deduplicationKey: deduplicationKey(type, sandbox.id, randomUUID()),
	};
}

export function sandboxStateWebhooks(
	sandbox: SandboxWebhookFields,
	previous: Pick<Sandbox, 'state'>
): WebhookPublication[] {
	if (previous.state === sandbox.state) return [];
	const data = {
		sandboxId: sandbox.id,
		organizationId: sandbox.organizationId,
		name: sandbox.name,
		state: sandbox.state,
		previousState: previous.state,
		errorReason: sandbox.errorReason,
		updatedAt: sandbox.updatedAt.toISOString(),
	};
	const specific = SANDBOX_STATE_WEBHOOK_EVENT[sandbox.state];
	const types = specific
		? [specific, WebhookEventType.SANDBOX_STATE_UPDATED]
		: [WebhookEventType.SANDBOX_STATE_UPDATED];
	const occurrence = randomUUID();
	return types.map((type) => ({
		organizationId: sandbox.organizationId,
		type,
		data,
		deduplicationKey: deduplicationKey(type, sandbox.id, occurrence),
	}));
}

export function sandboxPreemptedWebhook(
	sandbox: Pick<Sandbox, 'id' | 'organizationId' | 'name'>,
	machineId: string,
	preemptedAt: Date
): WebhookPublication {
	const type = WebhookEventType.SANDBOX_PREEMPTED;
	return {
		organizationId: sandbox.organizationId,
		type,
		data: {
			sandboxId: sandbox.id,
			organizationId: sandbox.organizationId,
			name: sandbox.name,
			machineId,
			preemptedAt: preemptedAt.toISOString(),
		},
		deduplicationKey: deduplicationKey(type, sandbox.id, randomUUID()),
	};
}

export function snapshotStateWebhook(
	snapshot: SnapshotWebhookFields,
	previous: Pick<Snapshot, 'state'>
): WebhookPublication | null {
	const type = SNAPSHOT_STATE_WEBHOOK_EVENT[snapshot.state];
	if (!type || !snapshot.organizationId || previous.state === snapshot.state) {
		return null;
	}
	return {
		organizationId: snapshot.organizationId,
		type,
		data: {
			snapshotId: snapshot.id,
			organizationId: snapshot.organizationId,
			name: snapshot.name,
			state: snapshot.state,
			previousState: previous.state,
			errorReason: snapshot.errorReason,
			updatedAt: snapshot.updatedAt.toISOString(),
		},
		deduplicationKey: deduplicationKey(type, snapshot.id, randomUUID()),
	};
}

export function snapshotDeletedWebhook(
	snapshot: Pick<Snapshot, 'id' | 'organizationId' | 'name'>,
	deletedAt: Date
): WebhookPublication | null {
	if (!snapshot.organizationId) return null;
	const type = WebhookEventType.SNAPSHOT_DELETED;
	return {
		organizationId: snapshot.organizationId,
		type,
		data: {
			snapshotId: snapshot.id,
			organizationId: snapshot.organizationId,
			name: snapshot.name,
			deletedAt: deletedAt.toISOString(),
		},
		deduplicationKey: deduplicationKey(type, snapshot.id, randomUUID()),
	};
}

function volumeData(volume: VolumeDto) {
	return {
		volumeId: volume.id,
		organizationId: volume.organizationId,
		name: volume.name,
		state: volume.state,
		errorReason: volume.errorReason ?? null,
		updatedAt: volume.updatedAt,
	};
}

export function volumeCreatedWebhook(
	volume: VolumeDto
): WebhookPublication | null {
	if (!volume.organizationId) return null;
	const type = WebhookEventType.VOLUME_CREATED;
	return {
		organizationId: volume.organizationId,
		type,
		data: volumeData(volume),
		deduplicationKey: deduplicationKey(type, volume.id, volume.updatedAt),
	};
}

export function volumeStateWebhook(
	volume: VolumeDto,
	previousState: VolumeDto['state']
): WebhookPublication | null {
	const type = VOLUME_STATE_WEBHOOK_EVENT[volume.state];
	if (!type || !volume.organizationId || previousState === volume.state) {
		return null;
	}
	return {
		organizationId: volume.organizationId,
		type,
		data: { ...volumeData(volume), previousState },
		deduplicationKey: deduplicationKey(
			type,
			volume.id,
			`${volume.state}${WEBHOOK_DEDUPLICATION_SEPARATOR}${volume.updatedAt}`
		),
	};
}
