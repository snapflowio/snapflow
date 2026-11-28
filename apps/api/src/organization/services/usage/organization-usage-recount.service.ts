/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CAPACITY_HOLD } from '../../../sandbox/values/sandbox-hold-policy.value';
import { Snapshot } from '../../../snapshot/entities/snapshot.entity';
import { Volume } from '../../../volume/entities/volume.entity';
import { SNAPSHOT_STATES_CONSUMING_RESOURCES } from '../../constants/snapshot-states-consuming-resources.constants';
import { VOLUME_STATES_CONSUMING_RESOURCES } from '../../constants/volume-states-consuming-resources.constants';
import type { SandboxUsageOverviewInternalDto } from '../../dto/sandbox-usage-overview-internal.dto';
import type { SnapshotUsageOverviewInternalDto } from '../../dto/snapshot-usage-overview-internal.dto';
import type { VolumeUsageOverviewInternalDto } from '../../dto/volume-usage-overview-internal.dto';
import type { SandboxUsageScope } from '../../utils/organization-usage.util';
import { OrganizationUsageCacheService } from './organization-usage-cache.service';

interface SandboxUsageMetricsRow {
	used_cpu: number;
	used_mem: number;
	used_disk: number;
	used_gpu: number;
}

const COMPUTE_HOLD = CAPACITY_HOLD.computeSql('sandbox');
const DISK_HOLD = CAPACITY_HOLD.diskSql('sandbox');

const SANDBOX_USAGE_METRICS_QUERY = `SELECT
   SUM(CASE WHEN ${COMPUTE_HOLD.sql} THEN sandbox.cpu ELSE 0 END) AS used_cpu,
   SUM(CASE WHEN ${COMPUTE_HOLD.sql} THEN sandbox.mem ELSE 0 END) AS used_mem,
   SUM(CASE WHEN ${DISK_HOLD.sql} THEN sandbox.disk ELSE 0 END) AS used_disk,
   SUM(CASE WHEN ${COMPUTE_HOLD.sql} THEN sandbox.gpu ELSE 0 END) AS used_gpu
 FROM sandbox
 WHERE sandbox."organizationId" = ?
   AND sandbox."sandboxClass" = ?`;

@Injectable()
export class OrganizationUsageRecountService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly usageCache: OrganizationUsageCacheService
	) {}

	async recountSandboxUsage(
		scope: SandboxUsageScope
	): Promise<SandboxUsageOverviewInternalDto> {
		const [metrics] = await this.entityManager.execute<
			SandboxUsageMetricsRow[]
		>(SANDBOX_USAGE_METRICS_QUERY, [
			...COMPUTE_HOLD.bindings,
			...COMPUTE_HOLD.bindings,
			...DISK_HOLD.bindings,
			...COMPUTE_HOLD.bindings,
			scope.organizationId,
			scope.sandboxClass,
		]);

		const usage: SandboxUsageOverviewInternalDto = {
			currentCpuUsage: Number(metrics?.used_cpu) || 0,
			currentMemoryUsage: Number(metrics?.used_mem) || 0,
			currentDiskUsage: Number(metrics?.used_disk) || 0,
			currentGpuUsage: Number(metrics?.used_gpu) || 0,
		};
		await this.usageCache.writeSandboxUsage(scope, usage);
		return usage;
	}

	async recountSnapshotUsage(
		organizationId: string
	): Promise<SnapshotUsageOverviewInternalDto> {
		const snapshotUsage = await this.entityManager.count(Snapshot, {
			organizationId,
			state: { $in: SNAPSHOT_STATES_CONSUMING_RESOURCES },
		});
		await this.usageCache.writeCountUsage(
			organizationId,
			'snapshot_count',
			'snapshot',
			snapshotUsage
		);
		return { currentSnapshotUsage: snapshotUsage };
	}

	async recountVolumeUsage(
		organizationId: string
	): Promise<VolumeUsageOverviewInternalDto> {
		const volumeUsage = await this.entityManager.count(Volume, {
			organizationId,
			state: { $in: VOLUME_STATES_CONSUMING_RESOURCES },
		});
		await this.usageCache.writeCountUsage(
			organizationId,
			'volume_count',
			'volume',
			volumeUsage
		);
		return { currentVolumeUsage: volumeUsage };
	}
}
