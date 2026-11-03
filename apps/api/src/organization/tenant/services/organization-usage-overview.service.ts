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
import { mapSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { Sandbox } from '../../../sandbox/instance/entities/sandbox.entity';
import type { SandboxClass } from '../../../sandbox/instance/enums/sandbox-class.enum';
import { ORGANIZATION_USAGE_CACHE } from '../constants/organization-usage-cache.constants';
import { SANDBOX_STATES_CONSUMING_COMPUTE } from '../constants/sandbox-states-consuming-compute.constants';
import { SANDBOX_STATES_CONSUMING_DISK } from '../constants/sandbox-states-consuming-disk.constants';
import type {
	OrganizationUsageOverviewDto,
	QuotaUsageOverviewDto,
} from '../dto/organization-usage-overview.dto';
import type {
	SandboxUsageOverviewInternalDto,
	SandboxUsageOverviewWithPendingInternalDto,
} from '../dto/sandbox-usage-overview-internal.dto';
import type { SnapshotUsageOverviewWithPendingInternalDto } from '../dto/snapshot-usage-overview-internal.dto';
import type { VolumeUsageOverviewWithPendingInternalDto } from '../dto/volume-usage-overview-internal.dto';
import type { SandboxUsageScope } from '../utils/organization-usage.util';
import { OrganizationLimitsService } from './organization-limits.service';
import { OrganizationQuotaService } from './organization-quota.service';
import { OrganizationUsageCacheService } from './organization-usage-cache.service';
import { OrganizationUsageRecountService } from './organization-usage-recount.service';

@Injectable()
export class OrganizationUsageOverviewService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly organizationLimits: OrganizationLimitsService,
		private readonly quotas: OrganizationQuotaService,
		private readonly usageCache: OrganizationUsageCacheService,
		private readonly usageRecount: OrganizationUsageRecountService
	) {}

	async getUsageOverview(
		organizationId: string
	): Promise<OrganizationUsageOverviewDto> {
		const limits = await this.organizationLimits.get(organizationId);
		const quotas = await this.quotas.list(organizationId);

		const quotaUsage: QuotaUsageOverviewDto[] = await mapSequentially(
			quotas,
			async (quota) => {
				const sandboxUsage = await this.getSandboxUsageOverview(
					organizationId,
					quota.sandboxClass
				);

				const usage: QuotaUsageOverviewDto = {
					sandboxClass: quota.sandboxClass,
					totalCpuQuota: quota.totalCpuQuota,
					totalMemoryQuota: quota.totalMemoryQuota,
					totalDiskQuota: quota.totalDiskQuota,
					totalGpuQuota: quota.totalGpuQuota,
					currentCpuUsage: sandboxUsage.currentCpuUsage,
					currentMemoryUsage: sandboxUsage.currentMemoryUsage,
					currentDiskUsage: sandboxUsage.currentDiskUsage,
					currentGpuUsage: sandboxUsage.currentGpuUsage,
					maxCpuPerSandbox: quota.maxCpuPerSandbox,
					maxMemoryPerSandbox: quota.maxMemoryPerSandbox,
					maxDiskPerSandbox: quota.maxDiskPerSandbox,
					maxDiskPerNonEphemeralSandbox: quota.maxDiskPerNonEphemeralSandbox,
					maxCpuPerGpuSandbox: quota.maxCpuPerGpuSandbox,
					maxMemoryPerGpuSandbox: quota.maxMemoryPerGpuSandbox,
					maxDiskPerGpuSandbox: quota.maxDiskPerGpuSandbox,
				};
				if (quota.allowedGpuTypes) {
					usage.allowedGpuTypes = quota.allowedGpuTypes;
				}

				return usage;
			}
		);

		const snapshotUsage = await this.getSnapshotUsageOverview(organizationId);
		const volumeUsage = await this.getVolumeUsageOverview(organizationId);

		return {
			quotaUsage,
			totalSnapshotQuota: limits.snapshotQuota,
			totalVolumeQuota: limits.volumeQuota,
			currentSnapshotUsage: snapshotUsage.currentSnapshotUsage,
			currentVolumeUsage: volumeUsage.currentVolumeUsage,
		};
	}

	async getSandboxUsageOverview(
		organizationId: string,
		sandboxClass: SandboxClass,
		excludeSandboxId?: string
	): Promise<SandboxUsageOverviewWithPendingInternalDto> {
		const scope: SandboxUsageScope = { organizationId, sandboxClass };
		const usageOverview = await this.readThrough(
			`organization:${organizationId}:fetch-sandbox-usage-from-db`,
			() => this.usageCache.readSandboxUsage(scope),
			async () => ({
				...(await this.usageRecount.recountSandboxUsage(scope)),
				...(await this.usageCache.readPendingSandboxUsage(scope)),
			})
		);

		return excludeSandboxId
			? this.excludeSandboxFromUsageOverview(
					usageOverview,
					excludeSandboxId,
					sandboxClass
				)
			: usageOverview;
	}

	async getSnapshotUsageOverview(
		organizationId: string
	): Promise<SnapshotUsageOverviewWithPendingInternalDto> {
		return this.readThrough(
			`organization:${organizationId}:fetch-snapshot-usage-from-db`,
			async () => {
				const cached = await this.usageCache.readCountUsage(
					organizationId,
					'snapshot_count',
					'snapshot'
				);
				return cached
					? {
							currentSnapshotUsage: cached.current,
							pendingSnapshotUsage: cached.pending,
						}
					: null;
			},
			async () => ({
				...(await this.usageRecount.recountSnapshotUsage(organizationId)),
				pendingSnapshotUsage: await this.usageCache.readPendingCountUsage(
					organizationId,
					'snapshot_count'
				),
			})
		);
	}

	async getVolumeUsageOverview(
		organizationId: string
	): Promise<VolumeUsageOverviewWithPendingInternalDto> {
		return this.readThrough(
			`organization:${organizationId}:fetch-volume-usage-from-db`,
			async () => {
				const cached = await this.usageCache.readCountUsage(
					organizationId,
					'volume_count',
					'volume'
				);
				return cached
					? {
							currentVolumeUsage: cached.current,
							pendingVolumeUsage: cached.pending,
						}
					: null;
			},
			async () => ({
				...(await this.usageRecount.recountVolumeUsage(organizationId)),
				pendingVolumeUsage: await this.usageCache.readPendingCountUsage(
					organizationId,
					'volume_count'
				),
			})
		);
	}

	private async readThrough<T>(
		lockKey: string,
		readCache: () => Promise<T | null>,
		load: () => Promise<T>
	): Promise<T> {
		const cached = await readCache();
		if (cached) {
			return cached;
		}

		const lease = await this.redisLockProvider.acquire(
			lockKey,
			ORGANIZATION_USAGE_CACHE.LOCK_TTL_SECONDS
		);
		try {
			return (await readCache()) ?? (await load());
		} finally {
			await lease.release();
		}
	}

	private async excludeSandboxFromUsageOverview<
		T extends SandboxUsageOverviewInternalDto,
	>(
		usageOverview: T,
		excludeSandboxId: string,
		sandboxClass: SandboxClass
	): Promise<T> {
		const excludedSandbox = await this.entityManager.findOne(Sandbox, {
			id: excludeSandboxId,
			sandboxClass,
		});

		if (!excludedSandbox) {
			return usageOverview;
		}

		const consumesCompute = SANDBOX_STATES_CONSUMING_COMPUTE.includes(
			excludedSandbox.state
		);
		const consumesDisk = SANDBOX_STATES_CONSUMING_DISK.includes(
			excludedSandbox.state
		);
		const subtract = (usage: number, amount: number, consumes: boolean) =>
			Math.max(0, usage - (consumes ? amount : 0));

		return {
			...usageOverview,
			currentCpuUsage: subtract(
				usageOverview.currentCpuUsage,
				excludedSandbox.cpu,
				consumesCompute
			),
			currentMemoryUsage: subtract(
				usageOverview.currentMemoryUsage,
				excludedSandbox.mem,
				consumesCompute
			),
			currentDiskUsage: subtract(
				usageOverview.currentDiskUsage,
				excludedSandbox.disk,
				consumesDisk
			),
			currentGpuUsage: subtract(
				usageOverview.currentGpuUsage,
				excludedSandbox.gpu,
				consumesCompute
			),
		};
	}
}
