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
import { SandboxDesiredState } from '../../sandbox/enums/sandbox-desired-state.enum';
import { Snapshot } from '../../snapshot/entities/snapshot.entity';
import { Volume } from '../../volume/entities/volume.entity';
import {
	SANDBOX_STATES_CONDITIONALLY_CONSUMING_COMPUTE,
	SANDBOX_STATES_CONSUMING_COMPUTE,
} from '../constants/sandbox-states-consuming-compute.constants';
import { SANDBOX_STATES_CONSUMING_DISK } from '../constants/sandbox-states-consuming-disk.constants';
import { SNAPSHOT_STATES_CONSUMING_RESOURCES } from '../constants/snapshot-states-consuming-resources.constants';
import { VOLUME_STATES_CONSUMING_RESOURCES } from '../constants/volume-states-consuming-resources.constants';
import type { SandboxUsageOverviewInternalDto } from '../dto/sandbox-usage-overview-internal.dto';
import type { SnapshotUsageOverviewInternalDto } from '../dto/snapshot-usage-overview-internal.dto';
import type { VolumeUsageOverviewInternalDto } from '../dto/volume-usage-overview-internal.dto';
import type { SandboxUsageScope } from '../utils/organization-usage.util';
import { OrganizationUsageCacheService } from './organization-usage-cache.service';

interface SandboxUsageMetricsRow {
	used_cpu: number;
	used_mem: number;
	used_disk: number;
	used_gpu: number;
}

const SANDBOX_USAGE_METRICS_QUERY = `SELECT
   SUM(CASE WHEN sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[]) OR (sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[]) AND sandbox."desiredState" = ?) THEN sandbox.cpu ELSE 0 END) AS used_cpu,
   SUM(CASE WHEN sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[]) OR (sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[]) AND sandbox."desiredState" = ?) THEN sandbox.mem ELSE 0 END) AS used_mem,
   SUM(CASE WHEN sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[]) THEN sandbox.disk ELSE 0 END) AS used_disk,
   SUM(CASE WHEN sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[]) OR (sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[]) AND sandbox."desiredState" = ?) THEN sandbox.gpu ELSE 0 END) AS used_gpu
 FROM sandbox
 WHERE sandbox."organizationId" = ?
   AND sandbox."sandboxClass" = ?`;

const COMPUTE_CONSUMPTION_PARAMETERS = [
	SANDBOX_STATES_CONSUMING_COMPUTE,
	SANDBOX_STATES_CONDITIONALLY_CONSUMING_COMPUTE,
	SandboxDesiredState.STARTED,
] as const;

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
			...COMPUTE_CONSUMPTION_PARAMETERS,
			...COMPUTE_CONSUMPTION_PARAMETERS,
			SANDBOX_STATES_CONSUMING_DISK,
			...COMPUTE_CONSUMPTION_PARAMETERS,
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
