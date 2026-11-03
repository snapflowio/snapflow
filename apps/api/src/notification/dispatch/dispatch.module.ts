/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { SandboxInstanceModule } from '../../sandbox/instance/instance.module';
import { NotificationService } from './services/notification.service';
import { RealtimeOutboxDispatcherService } from './services/realtime-outbox-dispatcher.service';

@Module({
	imports: [SandboxInstanceModule],
	providers: [RealtimeOutboxDispatcherService, NotificationService],
	exports: [RealtimeOutboxDispatcherService],
})
export class NotificationDispatchModule {}
