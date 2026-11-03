/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import {
	type NotificationBroadcast,
	NotificationEmitter,
} from '../../transport/gateways/notification-emitter.abstract';
import { NotificationRedisService } from '../../transport/services/notification-redis.service';

@Injectable()
export class NotificationRedisEmitter
	extends NotificationEmitter
	implements OnModuleInit
{
	private readonly logger = new Logger(NotificationRedisEmitter.name);
	private emitter: Emitter;

	constructor(private readonly notificationRedis: NotificationRedisService) {
		super();
	}

	async onModuleInit(): Promise<void> {
		this.emitter = await this.notificationRedis.createEmitter();
		this.logger.debug('Socket.io Redis emitter initialized');
	}

	protected broadcast(room: string): NotificationBroadcast {
		return this.emitter.to(room);
	}
}
