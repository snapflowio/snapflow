/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { setTimeout as sleep } from 'node:timers/promises';
import { IsolationLevel } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';

const SERIALIZATION_FAILURE_CODE = '40001';
const DEADLOCK_DETECTED_CODE = '40P01';
const MAXIMUM_TRANSACTION_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MILLISECONDS = 10;

export async function runSerializableTransaction<Result>(
	entityManager: EntityManager,
	operation: (manager: EntityManager) => Promise<Result>
): Promise<Result> {
	for (let attempt = 1; attempt <= MAXIMUM_TRANSACTION_ATTEMPTS; attempt += 1) {
		try {
			return await entityManager.transactional(operation, {
				isolationLevel: IsolationLevel.SERIALIZABLE,
			});
		} catch (error) {
			if (
				!isRetryableTransactionError(error) ||
				attempt === MAXIMUM_TRANSACTION_ATTEMPTS
			) {
				throw error;
			}
			const exponentialDelay =
				BASE_RETRY_DELAY_MILLISECONDS * 2 ** (attempt - 1);
			const jitter = Math.floor(Math.random() * BASE_RETRY_DELAY_MILLISECONDS);
			await sleep(exponentialDelay + jitter);
		}
	}
	throw new Error('Serializable transaction retry loop was exhausted');
}

function isRetryableTransactionError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null || !('code' in error)) {
		return false;
	}
	return (
		error.code === SERIALIZATION_FAILURE_CODE ||
		error.code === DEADLOCK_DETECTED_CODE
	);
}
