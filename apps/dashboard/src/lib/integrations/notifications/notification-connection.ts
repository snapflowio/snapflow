/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	Machine,
	Sandbox,
	SnapshotDto,
	VolumeDto,
} from '@snapflow/api-client';
import type { QueryClient, QueryKey } from '@tanstack/svelte-query';
import { isOrganizationContextChanged } from '#lib/api/client/organization-context.ts';
import { notificationQueryKeys } from '#lib/api/notifications.ts';
import {
	createNotificationSocket,
	type NotificationSocket,
} from './notification-client.ts';
import { NotificationEvent } from './notification-events.ts';

export interface NotificationHandlers {
	onSessionRejected: () => void;
}

export function openNotificationSocket(
	queryClient: QueryClient,
	organizationId: string | null,
	handlers: NotificationHandlers
): () => void {
	let closed = false;
	let dispose: (() => void) | null = null;
	void createNotificationSocket(organizationId).then((notificationSocket) => {
		if (!closed) {
			dispose = connectNotificationSocket(
				notificationSocket,
				queryClient,
				handlers
			);
		}
	});
	return () => {
		closed = true;
		dispose?.();
	};
}

function connectNotificationSocket(
	notificationSocket: NotificationSocket,
	queryClient: QueryClient,
	{ onSessionRejected }: NotificationHandlers
): () => void {
	const invalidate = (queryKeys: readonly QueryKey[]) => {
		for (const queryKey of queryKeys) {
			void queryClient.invalidateQueries({ queryKey });
		}
	};
	const invalidateSandbox = (sandbox: Sandbox) =>
		invalidate(notificationQueryKeys.sandbox(sandbox));
	const invalidateSnapshot = (snapshot: SnapshotDto) =>
		invalidate(notificationQueryKeys.snapshot(snapshot));
	const invalidateVolume = (volume: VolumeDto) =>
		invalidate(notificationQueryKeys.volume(volume));
	const invalidateMachine = (machine: Machine) =>
		invalidate(notificationQueryKeys.machine(machine));

	let connectedBefore = false;
	notificationSocket.on('connect', () => {
		if (connectedBefore) void queryClient.invalidateQueries();
		connectedBefore = true;
	});
	notificationSocket.on('connect_error', (error) => {
		if ('data' in error && isOrganizationContextChanged(error.data)) {
			onSessionRejected();
		}
	});
	notificationSocket.on(NotificationEvent.SANDBOX_CREATED, invalidateSandbox);
	notificationSocket.on(NotificationEvent.SANDBOX_STATE_UPDATED, (update) =>
		invalidateSandbox(update.sandbox)
	);
	notificationSocket.on(
		NotificationEvent.SANDBOX_DESIRED_STATE_UPDATED,
		(update) => invalidateSandbox(update.sandbox)
	);
	notificationSocket.on(NotificationEvent.SNAPSHOT_CREATED, invalidateSnapshot);
	notificationSocket.on(NotificationEvent.SNAPSHOT_REMOVED, invalidateSnapshot);
	notificationSocket.on(NotificationEvent.SNAPSHOT_STATE_UPDATED, (update) =>
		invalidateSnapshot(update.snapshot)
	);
	notificationSocket.on(NotificationEvent.VOLUME_CREATED, invalidateVolume);
	notificationSocket.on(NotificationEvent.VOLUME_STATE_UPDATED, (update) =>
		invalidateVolume(update.volume)
	);
	notificationSocket.on(
		NotificationEvent.VOLUME_LAST_USED_AT_UPDATED,
		invalidateVolume
	);
	notificationSocket.on(NotificationEvent.MACHINE_CREATED, invalidateMachine);
	notificationSocket.on(NotificationEvent.MACHINE_DELETED, invalidateMachine);
	notificationSocket.on(NotificationEvent.MACHINE_STATE_UPDATED, (update) =>
		invalidateMachine(update.machine)
	);
	notificationSocket.on(
		NotificationEvent.MACHINE_UNSCHEDULABLE_UPDATED,
		invalidateMachine
	);

	notificationSocket.connect();

	return () => {
		notificationSocket.removeAllListeners();
		notificationSocket.disconnect();
	};
}
