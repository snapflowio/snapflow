/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { MILLISECONDS_PER_MINUTE } from '../../common/constants/time.constants';
import { IsolatedEntityManagerContext } from '../../common/decorators/isolated-entity-manager-context.decorator';
import { millisecondsBetween } from '../../common/utils/time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import { OrganizationEvents } from '../../organization/constants/organization-events.constants';
import { OrganizationSuspendedSnapshotDeactivatedEvent } from '../../organization/events/organization-suspended-snapshot-deactivated.event';
import { OrganizationService } from '../../organization/services/organization.service';
import { SnapshotEvents } from '../constants/snapshot-events.constants';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotActivatedEvent } from '../events/snapshot-activated.event';
import { SnapshotRepository } from '../repositories/snapshot.repository';
import { SnapshotQuotaService } from './snapshot-quota.service';

const ACTIVATION_COOLDOWN_MS = 10 * MILLISECONDS_PER_MINUTE;
const ACTIVATION_LOCK_TTL_SECONDS = 60;
const ACTIVATED_SNAPSHOT_COUNT = 1;

@Injectable()
export class SnapshotStateService {
	private readonly logger = new Logger(SnapshotStateService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly snapshotRepository: SnapshotRepository,
		private readonly organizations: OrganizationService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly eventEmitter: EventEmitter2,
		private readonly snapshotQuota: SnapshotQuotaService,
		private readonly targets: MachineSnapshotTargetService
	) {}

	async activateSnapshot(
		snapshotId: string,
		organizationId: string
	): Promise<Snapshot> {
		const lockKey = `snapshot:${snapshotId}:activate`;
		const lease = await this.redisLockProvider.acquire(
			lockKey,
			ACTIVATION_LOCK_TTL_SECONDS
		);

		let reservedSnapshotCount: number | undefined;
		try {
			const snapshot = await this.findActivatable(snapshotId);
			await this.organizations.assertActive(organizationId);

			await this.snapshotQuota.reserve(
				organizationId,
				snapshot.sandboxClass,
				ACTIVATED_SNAPSHOT_COUNT,
				{
					cpu: snapshot.cpu,
					memory: snapshot.mem,
					disk: snapshot.disk,
					gpu: snapshot.gpu,
				}
			);
			reservedSnapshotCount = ACTIVATED_SNAPSHOT_COUNT;

			const updatedSnapshot = await this.snapshotRepository.update(snapshotId, {
				updateData: { state: SnapshotState.PENDING },
				entity: snapshot,
			});
			this.eventEmitter.emit(
				SnapshotEvents.ACTIVATED,
				new SnapshotActivatedEvent(updatedSnapshot)
			);
			return updatedSnapshot;
		} catch (error) {
			await this.snapshotQuota.release(organizationId, reservedSnapshotCount);
			throw error;
		} finally {
			await lease.release();
		}
	}

	// Re-queues a snapshot whose import failed. Its quota stays reserved from creation;
	// the ref and initial machine are cleared so the next attempt inspects afresh.
	async retryFailedSnapshot(snapshot: Snapshot): Promise<Snapshot> {
		if (snapshot.state !== SnapshotState.ERROR) {
			throw new BadRequestException(
				`Snapshot ${snapshot.id} is ${snapshot.state}, not ${SnapshotState.ERROR}`
			);
		}
		return this.snapshotRepository.update(snapshot.id, {
			updateData: {
				state: SnapshotState.PENDING,
				errorReason: null,
				ref: null,
				initialMachineId: null,
			},
			entity: snapshot,
		});
	}

	async deactivateSnapshot(snapshotId: string): Promise<void> {
		const snapshot = await this.entityManager.findOne(Snapshot, {
			id: snapshotId,
		});
		if (!snapshot) {
			throw new NotFoundException(`Snapshot ${snapshotId} not found`);
		}
		if (snapshot.state === SnapshotState.INACTIVE) {
			return;
		}

		await this.snapshotRepository.update(snapshotId, {
			updateData: { state: SnapshotState.INACTIVE },
			entity: snapshot,
		});

		const ref = snapshot.ref;
		if (!ref) return;
		const removed = await this.entityManager.transactional((manager) =>
			this.targets.removeInactivePropagation(manager, [ref])
		);
		this.logger.debug(
			`Deactivated snapshot ${snapshot.id} and stopped targeting ${removed} machines with it`
		);
	}

	@OnEvent(OrganizationEvents.SUSPENDED_SNAPSHOT_DEACTIVATED)
	@IsolatedEntityManagerContext()
	async handleSuspendedOrganizationSnapshotDeactivated(
		event: OrganizationSuspendedSnapshotDeactivatedEvent
	): Promise<void> {
		try {
			await this.deactivateSnapshot(event.snapshotId);
		} catch (error) {
			this.logger.error(
				`Error deactivating snapshot of suspended organization. SnapshotId: ${event.snapshotId}: `,
				error
			);
		}
	}

	private async findActivatable(snapshotId: string): Promise<Snapshot> {
		const snapshot = await this.entityManager.findOne(Snapshot, {
			id: snapshotId,
		});
		if (!snapshot) {
			throw new NotFoundException(`Snapshot ${snapshotId} not found`);
		}
		if (snapshot.state === SnapshotState.ACTIVE) {
			throw new BadRequestException(`Snapshot ${snapshotId} is already active`);
		}
		if (snapshot.state !== SnapshotState.INACTIVE) {
			throw new BadRequestException(
				`Snapshot ${snapshotId} cannot be activated - it is in ${snapshot.state} state`
			);
		}
		if (
			millisecondsBetween(snapshot.updatedAt, new Date()) <
			ACTIVATION_COOLDOWN_MS
		) {
			throw new BadRequestException(
				'Snapshot deactivation is still in progress. Please try again in a few minutes.'
			);
		}
		return snapshot;
	}
}
