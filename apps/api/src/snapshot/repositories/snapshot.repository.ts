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
import { Injectable, Logger } from '@nestjs/common';
import { CommittedEventPublisher } from '../../infra/database/services/committed-event-publisher.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import {
	snapshotDeletedWebhook,
	snapshotStateWebhook,
} from '../../webhook/utils/domain-webhook.util';
import { publishWebhook } from '../../webhook/utils/webhook-publish.util';
import { SnapshotEvents } from '../constants/snapshot-events.constants';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotCreatedEvent } from '../events/snapshot-created.event';
import { SnapshotRemovedEvent } from '../events/snapshot-removed.event';
import { SnapshotStateUpdatedEvent } from '../events/snapshot-state-updated.event';
import { SnapshotConflictException } from '../exceptions/snapshot-conflict.exception';
import { SnapshotNotFoundException } from '../exceptions/snapshot-not-found.exception';

@Injectable()
export class SnapshotRepository {
	private readonly logger = new Logger(SnapshotRepository.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly committedEvents: CommittedEventPublisher
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
		this.committedEvents.publish(
			SnapshotEvents.CREATED,
			new SnapshotCreatedEvent(snapshot)
		);

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
			throw new SnapshotNotFoundException(id);
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
				const previousState = current.state;
				Object.assign(current, updateData);
				current.updatedAt = new Date();
				const publication = snapshotStateWebhook(current, {
					state: previousState,
				});
				if (publication) await publishWebhook(manager, publication);
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
		await this.entityManager.transactional(
			async (manager) => {
				manager.remove(snapshots);
				await manager.flush();
				const deletedAt = await databaseNow(manager);
				for (const snapshot of snapshots) {
					const publication = snapshotDeletedWebhook(snapshot, deletedAt);
					if (publication) await publishWebhook(manager, publication);
				}
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		for (const snapshot of snapshots) {
			this.committedEvents.publish(
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
			this.committedEvents.publish(
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
