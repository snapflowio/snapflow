/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MILLISECONDS_PER_MINUTE } from '../../common/constants/time.constants';
import { IsolatedEntityManagerContext } from '../../common/decorators/isolated-entity-manager-context.decorator';
import { CommonErrorCode } from '../../common/enums/common-error-code.enum';
import { apiError } from '../../common/utils/error/api-error.util';
import { millisecondsBetween } from '../../common/utils/time.util';
import { CommittedEventPublisher } from '../../infra/database/services/committed-event-publisher.service';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import { OrganizationEvents } from '../../organization/constants/organization-events.constants';
import { OrganizationSuspendedSnapshotDeactivatedEvent } from '../../organization/events/organization-suspended-snapshot-deactivated.event';
import { OrganizationService } from '../../organization/services/organization.service';
import { SnapshotEvents } from '../constants/snapshot-events.constants';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotErrorCode } from '../enums/snapshot-error-code.enum';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotActivatedEvent } from '../events/snapshot-activated.event';
import { SnapshotNotFoundException } from '../exceptions/snapshot-not-found.exception';
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
		private readonly committedEvents: CommittedEventPublisher,
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
			this.committedEvents.publish(
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

	async retryFailedSnapshot(snapshot: Snapshot): Promise<Snapshot> {
		if (snapshot.state !== SnapshotState.ERROR) {
			throw new BadRequestException(
				apiError(
					SnapshotErrorCode.STATE_INVALID,
					`Snapshot ${snapshot.id} is ${snapshot.state}; only failed snapshots can be retried.`
				)
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
			throw new SnapshotNotFoundException(snapshotId);
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
			throw new SnapshotNotFoundException(snapshotId);
		}
		if (snapshot.state === SnapshotState.ACTIVE) {
			throw new BadRequestException(
				apiError(
					SnapshotErrorCode.STATE_INVALID,
					`Snapshot ${snapshotId} is already active. No action is needed.`
				)
			);
		}
		if (snapshot.state !== SnapshotState.INACTIVE) {
			throw new BadRequestException(
				apiError(
					SnapshotErrorCode.STATE_INVALID,
					`Snapshot ${snapshotId} is ${snapshot.state} and cannot be activated. Only inactive snapshots can be activated.`
				)
			);
		}
		if (
			millisecondsBetween(snapshot.updatedAt, new Date()) <
			ACTIVATION_COOLDOWN_MS
		) {
			throw new BadRequestException(
				apiError(
					CommonErrorCode.OPERATION_IN_PROGRESS,
					'The snapshot is still being deactivated. Try again in a few minutes.'
				)
			);
		}
		return snapshot;
	}
}
