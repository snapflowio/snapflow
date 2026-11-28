/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { NOTIFICATION_LIMITS } from '../constants/notification.constants';

class NotificationConnectionLimitError extends Error {
	constructor() {
		super('Notification connection capacity has been reached');
		this.name = NotificationConnectionLimitError.name;
	}
}

@Injectable()
export class NotificationConnectionsService {
	private total = 0;
	private readonly users = new Map<string, number>();

	acquire(userId: string): () => void {
		const userConnections = this.users.get(userId) ?? 0;
		if (
			this.total >= NOTIFICATION_LIMITS.maximumConnections ||
			userConnections >= NOTIFICATION_LIMITS.maximumConnectionsPerUser
		) {
			throw new NotificationConnectionLimitError();
		}

		this.total += 1;
		this.users.set(userId, userConnections + 1);

		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.total -= 1;
			const remaining = (this.users.get(userId) ?? 1) - 1;
			if (remaining === 0) this.users.delete(userId);
			else this.users.set(userId, remaining);
		};
	}
}
