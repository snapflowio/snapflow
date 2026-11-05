/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Emitter } from '@socket.io/redis-emitter';
import Redis from 'ioredis';

const NOTIFICATION_REDIS_CHANNEL_PREFIX = 'snapflow:notifications';

@Injectable()
export class NotificationRedisService implements OnApplicationShutdown {
	private readonly logger = new Logger(NotificationRedisService.name);
	private readonly clients = new Set<Redis>();
	private readonly errorHandlers = new Map<Redis, (error: Error) => void>();

	constructor(@InjectRedis() private readonly redis: Redis) {}

	async createSocketAdapter(): Promise<ReturnType<typeof createAdapter>> {
		const [publisher, subscriber] = await Promise.all([
			this.createClient('publisher'),
			this.createClient('subscriber', { enableReadyCheck: false }),
		]);
		return createAdapter(publisher, subscriber, {
			key: NOTIFICATION_REDIS_CHANNEL_PREFIX,
			publishOnSpecificResponseChannel: true,
		});
	}

	async createEmitter(): Promise<Emitter> {
		return new Emitter(await this.createClient('emitter'), {
			key: NOTIFICATION_REDIS_CHANNEL_PREFIX,
		});
	}

	async onApplicationShutdown(): Promise<void> {
		await Promise.all(
			[...this.clients].map((client) => this.closeClient(client))
		);
	}

	private async createClient(
		role: string,
		overrides?: Parameters<Redis['duplicate']>[0]
	): Promise<Redis> {
		const client = this.redis.duplicate(overrides);
		const handleError = (error: Error) =>
			this.logger.warn(`Notification Redis ${role} error: ${error.message}`);
		client.on('error', handleError);
		this.clients.add(client);
		this.errorHandlers.set(client, handleError);
		try {
			await waitUntilReady(client);
			return client;
		} catch (error) {
			await this.closeClient(client);
			throw new Error(`Failed to initialize notification Redis ${role}`, {
				cause: error,
			});
		}
	}

	private async closeClient(client: Redis): Promise<void> {
		this.clients.delete(client);
		const handleError = this.errorHandlers.get(client);
		if (handleError) client.off('error', handleError);
		this.errorHandlers.delete(client);
		if (client.status === 'end') return;
		try {
			await client.quit();
		} catch (error) {
			client.disconnect(false);
			this.logger.warn(
				'Notification Redis client required forced cleanup',
				error
			);
		}
	}
}

function waitUntilReady(client: Redis): Promise<void> {
	if (client.status === 'ready') return Promise.resolve();
	if (client.status === 'end') {
		return Promise.reject(new Error('Redis connection is already closed'));
	}

	return new Promise((resolve, reject) => {
		const cleanup = () => {
			client.off('ready', handleReady);
			client.off('error', handleError);
			client.off('end', handleEnd);
		};
		const handleReady = () => {
			cleanup();
			resolve();
		};
		const handleError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const handleEnd = () => {
			cleanup();
			reject(new Error('Redis connection closed before becoming ready'));
		};

		client.once('ready', handleReady);
		client.once('error', handleError);
		client.once('end', handleEnd);
		if (client.status === 'wait') void client.connect().catch(handleError);
	});
}
