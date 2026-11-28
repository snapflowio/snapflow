/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ORGANIZATION_CONTEXT_HEADER } from '@snapflow/organization-access';
import type { Socket } from 'socket.io-client';
import { REALTIME_PATH } from '#lib/config/service-paths.ts';
import type {
	NotificationClientEvents,
	NotificationServerEvents,
} from './notification-events.ts';

export type NotificationSocket = Socket<
	NotificationServerEvents,
	NotificationClientEvents
>;

export async function createNotificationSocket(
	organizationId: string | null
): Promise<NotificationSocket> {
	const { io } = await import('socket.io-client');
	return io(window.location.origin, {
		auth: organizationId
			? { [ORGANIZATION_CONTEXT_HEADER]: organizationId }
			: {},
		autoConnect: false,
		path: REALTIME_PATH,
		transports: ['websocket'],
		withCredentials: true,
	});
}
