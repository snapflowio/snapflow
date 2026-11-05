/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { NotificationConnectionsService } from './services/notification-connections.service';
import { NotificationRedisService } from './services/notification-redis.service';

@Module({
	providers: [NotificationConnectionsService, NotificationRedisService],
	exports: [NotificationConnectionsService, NotificationRedisService],
})
export class NotificationTransportModule {}
