/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import {
	type BeforeApplicationShutdown,
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { errorMessage } from '../../../common/utils/error/error.util';
import { TransactionCommitHooks } from '../../database/subscribers/transaction-commit-hooks.subscriber';
import { observeOperation } from '../../logging/utils/operation-observability.util';
import { CONTROL_WAKE } from '../constants/control-wake.constants';

const CONTROL_WAKE_CHANNEL_PATTERN = `${CONTROL_WAKE.channelPrefix}*`;
const CONTROL_WAKE_MESSAGE = 'changed';

@Injectable()
export class ControlWakeService
	implements OnModuleInit, BeforeApplicationShutdown, OnModuleDestroy
{
	private readonly logger = new Logger(ControlWakeService.name);
	private readonly subscriber: Redis;
	private readonly versions = new Map<string, number>();
	private readonly waiters = new Map<string, Set<() => void>>();
	private readonly listeners = new Map<string, Set<() => void>>();
	private sequence = 0;
	private stopping = false;

	constructor(
		@InjectRedis() private readonly redis: Redis,
		private readonly commitHooks: TransactionCommitHooks
	) {
		this.subscriber = redis.duplicate({ enableReadyCheck: false });
		this.subscriber.on('error', (error: Error) => {
			this.logger.warn(`Redis wake subscriber error: ${error.message}`);
		});
		this.subscriber.on('pmessage', (pattern: string, channel: string) => {
			if (pattern !== CONTROL_WAKE_CHANNEL_PATTERN) return;
			const key = channel.slice(CONTROL_WAKE.channelPrefix.length);
			if (key.length > 0) this.signal(key);
		});
	}

	async onModuleInit(): Promise<void> {
		try {
			await this.subscriber.psubscribe(CONTROL_WAKE_CHANNEL_PATTERN);
		} catch (error: unknown) {
			this.logger.warn(
				`Redis wake subscription is unavailable; waiters fall back to their deadlines: ${errorMessage(error)}`
			);
		}
	}

	async onModuleDestroy(): Promise<void> {
		this.stopWaiting();
		try {
			await this.subscriber.punsubscribe(CONTROL_WAKE_CHANNEL_PATTERN);
			await this.subscriber.quit();
		} catch (error: unknown) {
			this.logger.warn(
				`Could not close the Redis wake subscriber cleanly: ${errorMessage(error)}`
			);
			this.subscriber.disconnect(false);
		}
	}

	beforeApplicationShutdown(): void {
		this.stopping = true;
		this.stopWaiting();
	}

	isStopping(): boolean {
		return this.stopping;
	}

	capture(topic: string, id: string): number {
		return this.versions.get(this.key(topic, id)) ?? 0;
	}

	async waitForChange(
		topic: string,
		id: string,
		observedVersion: number,
		timeoutMilliseconds: number,
		signal?: AbortSignal
	): Promise<void> {
		const key = this.key(topic, id);
		if (
			this.current(key) !== observedVersion ||
			timeoutMilliseconds <= 0 ||
			signal?.aborted
		) {
			return;
		}
		await new Promise<void>((resolve) => {
			let completed = false;
			const complete = (): void => {
				if (completed) return;
				completed = true;
				clearTimeout(timeout);
				signal?.removeEventListener('abort', complete);
				const keyWaiters = this.waiters.get(key);
				keyWaiters?.delete(complete);
				if (keyWaiters?.size === 0) this.waiters.delete(key);
				resolve();
			};
			const timeout = setTimeout(complete, timeoutMilliseconds);
			signal?.addEventListener('abort', complete, { once: true });
			const keyWaiters = this.waiters.get(key) ?? new Set<() => void>();
			keyWaiters.add(complete);
			this.waiters.set(key, keyWaiters);
			if (this.current(key) !== observedVersion) complete();
		});
	}

	waiterCount(topic: string, id: string): number {
		return this.waiters.get(this.key(topic, id))?.size ?? 0;
	}

	subscribe(topic: string, id: string, listener: () => void): () => void {
		const key = this.key(topic, id);
		const keyListeners = this.listeners.get(key) ?? new Set<() => void>();
		keyListeners.add(listener);
		this.listeners.set(key, keyListeners);
		return () => {
			keyListeners.delete(listener);
			if (keyListeners.size === 0) this.listeners.delete(key);
		};
	}

	notify(topic: string, ids: Iterable<string>): void {
		for (const id of new Set(ids)) {
			const key = this.key(topic, id);
			this.signal(key);
			observeOperation(
				'control.wake.publish',
				{ 'wake.topic': topic },
				() =>
					this.redis.publish(
						`${CONTROL_WAKE.channelPrefix}${key}`,
						CONTROL_WAKE_MESSAGE
					),
				{ 'wake.subject': id }
			).catch((error: unknown) => {
				this.logger.warn(
					`Could not publish the ${topic} wake hint for ${id}: ${errorMessage(error)}`
				);
			});
		}
	}

	notifyAfterCommit(
		manager: EntityManager,
		topic: string,
		ids: Iterable<string>
	): void {
		const uniqueIds = [...new Set(ids)];
		if (uniqueIds.length === 0) return;
		this.commitHooks.runAfterCommit(manager, () =>
			this.notify(topic, uniqueIds)
		);
	}

	private current(key: string): number {
		return this.versions.get(key) ?? 0;
	}

	private signal(key: string): void {
		this.sequence += 1;
		this.versions.delete(key);
		this.versions.set(key, this.sequence);
		if (this.versions.size > CONTROL_WAKE.maximumTrackedKeys) {
			const oldest = this.versions.keys().next();
			if (!oldest.done) this.versions.delete(oldest.value);
		}
		for (const listener of this.listeners.get(key) ?? []) listener();
		const keyWaiters = this.waiters.get(key);
		if (!keyWaiters) return;
		this.waiters.delete(key);
		for (const resolve of keyWaiters) resolve();
	}

	private stopWaiting(): void {
		for (const keyWaiters of this.waiters.values()) {
			for (const resolve of keyWaiters) resolve();
		}
		this.waiters.clear();
	}

	private key(topic: string, id: string): string {
		return `${topic}:${id}`;
	}
}
