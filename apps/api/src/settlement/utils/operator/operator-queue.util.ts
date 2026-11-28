/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Logger } from '@nestjs/common';
import { BaseError } from 'viem';
import { isChainUnreachable } from '../chain-error.util';

const RELAY_FAILURE_UNEXPECTED = 'the relayer could not send it';

export interface QueuedRelay<T> {
	relay(item: T): Promise<void>;
	fail(item: T, reason: string): Promise<void>;
}

export async function relayEach<T>(
	queued: readonly T[],
	logger: Logger,
	{ relay, fail }: QueuedRelay<T>
): Promise<void> {
	for (const item of queued) {
		try {
			await relay(item);
		} catch (error) {
			if (isChainUnreachable(error)) throw error;
			logger.error('Relaying a queued item failed', error);
			await fail(
				item,
				error instanceof BaseError
					? error.shortMessage
					: RELAY_FAILURE_UNEXPECTED
			);
		}
	}
}

export function relayOnePerKey<T>(
	queued: readonly T[],
	inFlightKeys: Iterable<string>,
	keyOf: (item: T) => string,
	logger: Logger,
	queuedRelay: QueuedRelay<T>
): Promise<void> {
	const busy = new Set(inFlightKeys);
	const next = queued.filter((item) => {
		const key = keyOf(item);
		if (busy.has(key)) return false;
		busy.add(key);
		return true;
	});
	return relayEach(next, logger, queuedRelay);
}

interface QueuedOutcomes {
	fail(manager: EntityManager, id: string, reason: string): Promise<unknown>;
}

export async function failQueued(
	entityManager: EntityManager,
	logger: Logger,
	outcomes: QueuedOutcomes,
	failure: { id: string; description: string; reason: string }
): Promise<void> {
	logger.warn(`${failure.description} was not relayed: ${failure.reason}`);
	await entityManager
		.fork()
		.transactional((manager) =>
			outcomes.fail(manager, failure.id, failure.reason)
		);
}
