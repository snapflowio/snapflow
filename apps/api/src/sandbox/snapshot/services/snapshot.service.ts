/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type FilterQuery, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { validate as isUUID } from 'uuid';
import { ID_OR_NAME_MATCH_LIMIT } from '../../../common/constants/query.constants';
import { IsolatedEntityManagerContext } from '../../../common/decorators/isolated-entity-manager-context.decorator';
import { OnAsyncEvent } from '../../../common/decorators/on-async-event.decorator';
import type { CursorPage } from '../../../common/dto/cursor-page.dto';
import { findCursorPage } from '../../../common/utils/pagination/cursor-page.util';
import { containsPattern } from '../../../common/utils/pagination/like-pattern.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { ObjectStorageService } from '../../../object-storage/services/object-storage.service';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxCreatedEvent } from '../../events/sandbox-create.event';
import { MachineEvents } from '../../machine/constants/machine-events.constants';
import { MachineDeletedEvent } from '../../machine/events/machine-deleted.event';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import {
	SnapshotSortDirection,
	SnapshotSortField,
} from '../dto/list-snapshots-query.dto';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotMachine } from '../entities/snapshot-machine.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotRepository } from '../repositories/snapshot.repository';

const DEFAULT_SNAPSHOT_PAGE_SIZE = 10;
const LAST_USED_UPDATE_LOCK_TTL_SECONDS = 60;
const SNAPSHOT_SORT_PROPERTIES = {
	[SnapshotSortField.NAME]: 'name',
	[SnapshotSortField.STATE]: 'state',
	[SnapshotSortField.LAST_USED_AT]: 'lastUsedAt',
	[SnapshotSortField.CREATED_AT]: 'createdAt',
} as const satisfies Record<SnapshotSortField, keyof Snapshot>;
const UNUSABLE_SNAPSHOT_STATES = [
	SnapshotState.ERROR,
	SnapshotState.BUILD_FAILED,
];

type SnapshotListFilters = Readonly<{ name?: string }>;
type SnapshotListSort = Readonly<{
	field?: SnapshotSortField;
	direction?: SnapshotSortDirection;
}>;

@Injectable()
export class SnapshotService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly snapshotRepository: SnapshotRepository,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly objectStorageService: ObjectStorageService,
		private readonly targets: MachineSnapshotTargetService
	) {}

	async removeSnapshot(snapshotId: string): Promise<void> {
		const snapshot = await this.getSnapshot(snapshotId);
		if (snapshot.general) {
			throw new ForbiddenException('You cannot delete a general snapshot');
		}

		await this.snapshotRepository.update(snapshotId, {
			updateData: { state: SnapshotState.REMOVING },
			entity: snapshot,
		});
	}

	async getAllSnapshots(
		organizationId: string,
		limit = DEFAULT_SNAPSHOT_PAGE_SIZE,
		cursor?: string,
		filters?: SnapshotListFilters,
		sort?: SnapshotListSort
	): Promise<CursorPage<Snapshot>> {
		const name = filters?.name;
		const sortField = sort?.field ?? SnapshotSortField.LAST_USED_AT;
		const sortDirection = sort?.direction ?? SnapshotSortDirection.DESC;
		const nameFilter: FilterQuery<Snapshot> = name
			? { name: { $ilike: containsPattern(name) } }
			: {};

		const page = await findCursorPage(this.entityManager, Snapshot, {
			where: {
				$or: [
					{ ...nameFilter, organizationId },
					{ ...nameFilter, general: true, hideFromUsers: false },
				],
			},
			orderBy: {
				general: QueryOrder.ASC,
				[SNAPSHOT_SORT_PROPERTIES[sortField]]:
					sortDirection === SnapshotSortDirection.ASC
						? QueryOrder.ASC_NULLS_LAST
						: QueryOrder.DESC_NULLS_LAST,
				...(sortField !== SnapshotSortField.CREATED_AT && {
					createdAt: QueryOrder.DESC,
				}),
				id: QueryOrder.DESC,
			},
			limit,
			cursor,
		});

		return page;
	}

	async getSnapshot(snapshotId: string): Promise<Snapshot> {
		const snapshot = await this.entityManager.findOne(Snapshot, {
			id: snapshotId,
		});
		if (!snapshot) {
			throw new NotFoundException(`Snapshot ${snapshotId} not found`);
		}
		return snapshot;
	}

	async findAccessibleSnapshot(
		snapshotIdOrName: string,
		organizationId: string
	): Promise<Snapshot> {
		const where: FilterQuery<Snapshot>[] = [
			{ name: snapshotIdOrName, organizationId },
			{ name: snapshotIdOrName, general: true },
		];
		if (isUUID(snapshotIdOrName)) {
			where.push({ id: snapshotIdOrName });
		}

		const snapshot = await this.entityManager.findOne(
			Snapshot,
			{ $or: where },
			{ orderBy: { general: QueryOrder.ASC } }
		);
		if (!snapshot) {
			throw new NotFoundException(`Snapshot ${snapshotIdOrName} not found`);
		}

		return snapshot;
	}

	async getSnapshotByName(
		snapshotName: string,
		organizationId: string
	): Promise<Snapshot> {
		const snapshots = await this.entityManager.find(
			Snapshot,
			{
				name: snapshotName,
				$or: [{ organizationId }, { general: true }],
			},
			{ limit: ID_OR_NAME_MATCH_LIMIT }
		);
		const snapshot =
			snapshots.find(
				(candidate) => candidate.organizationId === organizationId
			) ?? snapshots.find(({ general }) => general);
		if (snapshot) return snapshot;
		throw new NotFoundException(`Snapshot with name ${snapshotName} not found`);
	}

	async setSnapshotGeneralStatus(
		snapshotId: string,
		general: boolean
	): Promise<Snapshot> {
		const snapshot = await this.getSnapshot(snapshotId);
		return this.snapshotRepository.update(snapshotId, {
			updateData: { general },
			entity: snapshot,
		});
	}

	async getBuildLogsUrl(snapshot: Snapshot): Promise<string> {
		if (!snapshot.organizationId || !snapshot.buildInfo?.snapshotRef) {
			throw new NotFoundException(
				`Snapshot ${snapshot.id} has no build-log artifact`
			);
		}
		return this.objectStorageService.createBuildLogDownload(
			snapshot.organizationId,
			snapshot.buildInfo.snapshotRef
		);
	}

	async canCleanupImage(imageName: string): Promise<boolean> {
		const snapshot = await this.entityManager.findOne(Snapshot, {
			state: { $nin: UNUSABLE_SNAPSHOT_STATES },
			ref: imageName,
		});
		if (snapshot) {
			return false;
		}

		const sandbox = await this.entityManager
			.createQueryBuilder(Sandbox, 'sandbox')
			.where(
				'(sandbox."existingBackupSnapshots" @> ?::jsonb OR sandbox."existingBackupSnapshots" @> ?::jsonb OR sandbox."backupSnapshot" = ?)',
				[
					JSON.stringify([{ snapshotName: imageName }]),
					JSON.stringify([{ imageName }]),
					imageName,
				]
			)
			.getSingleResult();
		return !sandbox || sandbox.state === SandboxState.DESTROYED;
	}

	@OnEvent(SandboxEvents.CREATED)
	@IsolatedEntityManagerContext()
	async handleSandboxCreatedEvent(event: SandboxCreatedEvent): Promise<void> {
		const { snapshot: snapshotName, organizationId, createdAt } = event.sandbox;
		if (!snapshotName) {
			return;
		}
		const acquired = await this.redisLockProvider.claim(
			`snapshot:${snapshotName}:update-last-used`,
			LAST_USED_UPDATE_LOCK_TTL_SECONDS
		);
		if (!acquired) {
			return;
		}

		const snapshot = await this.getSnapshotByName(snapshotName, organizationId);
		await this.snapshotRepository.updateNative(snapshot.id, {
			lastUsedAt: createdAt,
		});
	}

	@OnAsyncEvent({
		event: MachineEvents.DELETED,
	})
	async handleMachineDeletedEvent(payload: MachineDeletedEvent): Promise<void> {
		await payload.entityManager.nativeDelete(SnapshotMachine, {
			machineId: payload.machineId,
		});
		await this.targets.remove(payload.entityManager, {
			machineId: payload.machineId,
		});
	}
}
