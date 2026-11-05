/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable } from '@nestjs/common';
import { registryRepositoryPrefix } from '../../../docker-registry/persistence/utils/docker-registry-url.util';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import type { OrganizationLimits } from '../../../organization/entities/organization-limits.entity';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { CreateBuildInfoDto } from '../dto/create-build-info.dto';
import {
	BuildInfo,
	generateBuildInfoHash as generateBuildSnapshotRef,
} from '../entities/build-info.entity';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotMachineState } from '../enums/snapshot-machine-state.enum';
import { SnapshotState } from '../enums/snapshot-state.enum';

const BUILD_INFO_TOUCH_LOCK_TTL_SECONDS = 60;

type BuildRegistration = Readonly<{
	snapshot: Snapshot;
	buildInfo: CreateBuildInfoDto;
	organizationLimits: Pick<OrganizationLimits, 'maxSnapshotSize'>;
}>;

@Injectable()
export class SnapshotBuildRegistrationService {
	constructor(
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly redisLockProvider: RedisLockProvider
	) {}

	async attachBuild(
		manager: EntityManager,
		{ snapshot, buildInfo, organizationLimits }: BuildRegistration
	): Promise<void> {
		const buildSnapshotRef = generateBuildSnapshotRef(
			buildInfo.dockerfileContent,
			buildInfo.contextHashes
		);
		snapshot.buildInfo = await this.findOrCreateBuildInfo(
			manager,
			buildSnapshotRef,
			buildInfo
		);

		const internalRegistry =
			this.dockerRegistryService.getAvailableInternalRegistry();
		snapshot.ref = `${registryRepositoryPrefix(internalRegistry)}/${buildSnapshotRef}`;

		if (await this.heldByReadyMachine(manager, snapshot.ref)) {
			await this.reuseHeldImage(manager, snapshot, organizationLimits);
		}
	}

	private async findOrCreateBuildInfo(
		manager: EntityManager,
		snapshotRef: string,
		buildInfo: CreateBuildInfoDto
	): Promise<BuildInfo> {
		const existing = await manager.findOne(BuildInfo, { snapshotRef });
		if (existing) {
			if (
				await this.redisLockProvider.claim(
					`build-info:${existing.snapshotRef}:update`,
					BUILD_INFO_TOUCH_LOCK_TTL_SECONDS
				)
			) {
				existing.lastUsedAt = new Date();
			}
			return existing;
		}

		const now = new Date();
		const created = manager.create(BuildInfo, {
			snapshotRef,
			...buildInfo,
			lastUsedAt: now,
			createdAt: now,
			updatedAt: now,
		});
		manager.persist(created);
		return created;
	}

	private async reuseHeldImage(
		manager: EntityManager,
		snapshot: Snapshot,
		organizationLimits: Pick<OrganizationLimits, 'maxSnapshotSize'>
	): Promise<void> {
		const existing = await manager.findOne(
			Snapshot,
			{ ref: snapshot.ref, size: { $ne: null } },
			{ fields: ['id', 'size'] }
		);
		if (existing?.size == null) return;
		if (existing.size > organizationLimits.maxSnapshotSize) {
			throw new BadRequestException(
				`Snapshot size (${existing.size.toFixed(2)}GB) exceeds maximum allowed size of ${organizationLimits.maxSnapshotSize}GB`
			);
		}
		snapshot.size = existing.size;
		snapshot.state = SnapshotState.ACTIVE;
		snapshot.lastUsedAt = new Date();
	}

	private async heldByReadyMachine(
		manager: EntityManager,
		ref: string
	): Promise<boolean> {
		const rows = await manager.execute<{ exists: boolean }[]>(
			`SELECT EXISTS (
			   SELECT 1
			   FROM snapshot_machine snapshot_machine
			   INNER JOIN machine ON machine.id = snapshot_machine."machineId"
			   WHERE snapshot_machine."snapshotRef" = ?
			     AND snapshot_machine.state = ?
			     AND machine.state = ?
			     AND machine.unschedulable = false
			 ) AS exists`,
			[ref, SnapshotMachineState.PRESENT, MachineState.READY]
		);
		return rows[0]?.exists === true;
	}
}
