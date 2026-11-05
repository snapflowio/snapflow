/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { fakeInstance, fakeValue } from '../../common/testing/instance.fake';
import { TransactionCommitHooks } from '../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import { SnapshotEvents } from '../constants/snapshot-events.constants';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotCreatedEvent } from '../events/snapshot-created.event';
import { SnapshotRepository } from './snapshot.repository';

const SNAPSHOT_ID = '3c000000-0000-4000-8000-000000000001';

type CommitAction = Parameters<TransactionCommitHooks['runAfterCommit']>[1];

describe('SnapshotRepository.insert', () => {
	it('announces a new snapshot only after its transaction commits', async () => {
		const pendingCommit: CommitAction[] = [];
		const commitHooks = fakeInstance(TransactionCommitHooks, {
			runAfterCommit: (
				...hook: Parameters<TransactionCommitHooks['runAfterCommit']>
			) => {
				pendingCommit.push(hook[1]);
			},
		});
		const emit = mock.fn();
		const entityManager = fakeInstance(EntityManager, {
			transactional: async (work: (manager: EntityManager) => Promise<void>) =>
				work(fakeInstance(EntityManager, { persist: () => undefined })),
		});
		const repository = new SnapshotRepository(
			entityManager,
			fakeValue<EventEmitter2>({ emit }),
			commitHooks
		);
		const snapshot = fakeInstance(Snapshot, {
			id: SNAPSHOT_ID,
		});

		await repository.insert(snapshot);

		assert.equal(emit.mock.callCount(), 0);
		for (const action of pendingCommit) action();
		const [name, event] = emit.mock.calls[0]?.arguments ?? [];
		assert.equal(name, SnapshotEvents.CREATED);
		assert.ok(event instanceof SnapshotCreatedEvent);
		assert.equal(event.snapshot.id, SNAPSHOT_ID);
	});
});
