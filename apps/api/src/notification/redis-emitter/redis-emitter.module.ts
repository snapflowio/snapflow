/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Global, Module } from '@nestjs/common';
import { NotificationEmitter } from '../transport/gateways/notification-emitter.abstract';
import { NotificationTransportModule } from '../transport/transport.module';
import { NotificationRedisEmitter } from './emitters/notification-redis.emitter';

@Global()
@Module({
	imports: [NotificationTransportModule],
	providers: [
		{ provide: NotificationEmitter, useClass: NotificationRedisEmitter },
	],
	exports: [NotificationEmitter],
})
export class NotificationRedisEmitterModule {}
