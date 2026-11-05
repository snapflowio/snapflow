/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionCommitHooks } from '../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import { SnapshotEvents } from '../constants/snapshot-events.constants';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotCreatedEvent } from '../events/snapshot-created.event';
import { SnapshotRemovedEvent } from '../events/snapshot-removed.event';
import { SnapshotStateUpdatedEvent } from '../events/snapshot-state-updated.event';
import { SnapshotConflictException } from '../exceptions/snapshot-conflict.exception';

@Injectable()
export class SnapshotRepository {
	private readonly logger = new Logger(SnapshotRepository.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly eventEmitter: EventEmitter2,
		private readonly commitHooks: TransactionCommitHooks
	) {}

	async insert(snapshot: Snapshot): Promise<Snapshot> {
		const now = new Date();
		if (!snapshot.createdAt) {
			snapshot.createdAt = now;
		}
		if (!snapshot.updatedAt) {
			snapshot.updatedAt = now;
		}

		await this.entityManager.transactional(
			async (entityManager) => {
				entityManager.persist(snapshot);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		this.commitHooks.runAfterCommit(this.entityManager, () => {
			this.eventEmitter.emit(
				SnapshotEvents.CREATED,
				new SnapshotCreatedEvent(snapshot)
			);
		});

		return snapshot;
	}

	updateNative(id: string, updateData: Partial<Snapshot>): Promise<number> {
		return this.entityManager.nativeUpdate(
			Snapshot,
			{ id },
			{ ...updateData, updatedAt: new Date() }
		);
	}

	async update(
		id: string,
		params: { updateData: Partial<Snapshot>; entity?: Snapshot }
	): Promise<Snapshot> {
		const { updateData, entity } = params;

		const candidate =
			entity ?? (await this.entityManager.findOne(Snapshot, { id }));
		if (!candidate) {
			throw new NotFoundException('Snapshot not found');
		}

		const previousSnapshot = { ...candidate };
		const snapshot = await this.entityManager.transactional(
			async (manager) => {
				const current = await manager.findOne(
					Snapshot,
					{ id },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!current) throw new SnapshotConflictException();
				Object.assign(current, updateData);
				current.updatedAt = new Date();
				return current;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);

		await this.emitUpdateEvents(snapshot, previousSnapshot);

		return snapshot;
	}

	async removeAndFlush(snapshot: Snapshot): Promise<Snapshot> {
		await this.removeManyAndFlush([snapshot]);
		return snapshot;
	}

	async removeManyAndFlush(snapshots: readonly Snapshot[]): Promise<void> {
		if (snapshots.length === 0) return;
		this.entityManager.remove(snapshots);
		await this.entityManager.flush();
		for (const snapshot of snapshots) {
			this.eventEmitter.emit(
				SnapshotEvents.REMOVED,
				new SnapshotRemovedEvent(snapshot)
			);
		}
	}

	private async emitUpdateEvents(
		updatedSnapshot: Snapshot,
		previousSnapshot: Pick<Snapshot, 'state'>
	): Promise<void> {
		if (previousSnapshot.state !== updatedSnapshot.state) {
			this.eventEmitter.emit(
				SnapshotEvents.STATE_UPDATED,
				new SnapshotStateUpdatedEvent(
					updatedSnapshot,
					previousSnapshot.state,
					updatedSnapshot.state
				)
			);
		}
	}
}
