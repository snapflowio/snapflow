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
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import type { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import {
	ORGANIZATION_USAGE_CACHE,
	QUOTA_RESERVATION_CACHE_RETRIES,
	QUOTA_RESERVATION_STATUS,
} from '../constants/organization-usage-cache.constants';
import {
	DECREMENT_PENDING_COUNT_USAGE_SCRIPT,
	DECREMENT_PENDING_SANDBOX_USAGE_SCRIPT,
	INCREMENT_PENDING_COUNT_USAGE_SCRIPT,
	INCREMENT_PENDING_SANDBOX_USAGE_SCRIPT,
	RESERVE_PENDING_SANDBOX_USAGE_SCRIPT,
} from '../constants/organization-usage-redis-scripts.constants';
import { SANDBOX_STATES_CONSUMING_COMPUTE } from '../constants/sandbox-states-consuming-compute.constants';
import { SANDBOX_STATES_CONSUMING_DISK } from '../constants/sandbox-states-consuming-disk.constants';
import {
	type OrganizationCountQuotaType,
	SANDBOX_QUOTA_RESOURCES,
	type SandboxQuotaResource,
	type SandboxResourceAmounts,
	type SandboxUsageScope,
} from '../utils/organization-usage.util';
import {
	countUsageKey,
	sandboxUsageKey,
} from '../utils/organization-usage-cache.util';
import { OrganizationUsageCacheService } from './organization-usage-cache.service';
import { OrganizationUsageOverviewService } from './organization-usage-overview.service';

type SandboxIncrementFlags = Record<SandboxQuotaResource, boolean>;

export interface SandboxQuotaReservation {
	cpuIncremented: boolean;
	memoryIncremented: boolean;
	diskIncremented: boolean;
	gpuIncremented: boolean;
	exceededResource: SandboxQuotaResource | null;
	postReservation: SandboxResourceAmounts;
}

@Injectable()
export class OrganizationUsageService {
	constructor(
		@InjectRedis() private readonly redis: Redis,
		private readonly entityManager: EntityManager,
		private readonly usageCache: OrganizationUsageCacheService,
		private readonly usageOverview: OrganizationUsageOverviewService
	) {}

	async incrementPendingSandboxUsage(
		organizationId: string,
		sandboxClass: SandboxClass,
		cpu: number,
		memory: number,
		disk: number,
		gpu: number,
		excludeSandboxId?: string
	): Promise<{
		cpuIncremented: boolean;
		memoryIncremented: boolean;
		diskIncremented: boolean;
		gpuIncremented: boolean;
	}> {
		const flags = await this.getPendingSandboxIncrementFlags(
			sandboxClass,
			excludeSandboxId
		);
		const amounts: SandboxResourceAmounts = { cpu, memory, disk, gpu };

		await this.redis.eval(
			INCREMENT_PENDING_SANDBOX_USAGE_SCRIPT,
			SANDBOX_QUOTA_RESOURCES.length,
			...this.pendingSandboxKeys({ organizationId, sandboxClass }),
			...SANDBOX_QUOTA_RESOURCES.map((resource) => String(flags[resource])),
			...SANDBOX_QUOTA_RESOURCES.map((resource) => String(amounts[resource])),
			ORGANIZATION_USAGE_CACHE.TTL_SECONDS.toString()
		);

		return {
			cpuIncremented: flags.cpu,
			memoryIncremented: flags.memory,
			diskIncremented: flags.disk,
			gpuIncremented: flags.gpu,
		};
	}

	async reservePendingSandboxUsage(
		organizationId: string,
		sandboxClass: SandboxClass,
		request: SandboxResourceAmounts,
		limits: SandboxResourceAmounts,
		excludeSandboxId?: string
	): Promise<SandboxQuotaReservation> {
		const scope: SandboxUsageScope = { organizationId, sandboxClass };
		const flags = await this.getPendingSandboxIncrementFlags(
			sandboxClass,
			excludeSandboxId
		);
		const keys = [
			...SANDBOX_QUOTA_RESOURCES.map((resource) =>
				sandboxUsageKey('current', scope, resource)
			),
			...this.pendingSandboxKeys(scope),
		];
		const args = [
			...SANDBOX_QUOTA_RESOURCES.map((resource) => String(flags[resource])),
			...SANDBOX_QUOTA_RESOURCES.map((resource) => String(request[resource])),
			...SANDBOX_QUOTA_RESOURCES.map((resource) => String(limits[resource])),
			ORGANIZATION_USAGE_CACHE.TTL_SECONDS.toString(),
		];

		for (
			let attempt = 0;
			attempt < QUOTA_RESERVATION_CACHE_RETRIES;
			attempt++
		) {
			await this.usageOverview.getSandboxUsageOverview(
				organizationId,
				sandboxClass
			);
			const result = (await this.redis.eval(
				RESERVE_PENDING_SANDBOX_USAGE_SCRIPT,
				keys.length,
				...keys,
				...args
			)) as number[];
			const [status, exceededResourceNumber, ...postReservation] = result;
			if (status === QUOTA_RESERVATION_STATUS.cacheMiss) continue;
			return this.toReservation(
				status,
				exceededResourceNumber,
				postReservation,
				flags,
				request
			);
		}

		throw new Error('Sandbox usage cache expired during quota reservation');
	}

	async decrementPendingSandboxUsage(
		organizationId: string,
		sandboxClass: SandboxClass,
		cpu?: number,
		memory?: number,
		disk?: number,
		gpu?: number
	): Promise<void> {
		await this.redis.eval(
			DECREMENT_PENDING_SANDBOX_USAGE_SCRIPT,
			SANDBOX_QUOTA_RESOURCES.length,
			...this.pendingSandboxKeys({ organizationId, sandboxClass }),
			...[cpu, memory, disk, gpu].map((amount) => amount?.toString() ?? '0')
		);
	}

	async incrementPendingSnapshotUsage(
		organizationId: string,
		snapshotCount: number
	): Promise<void> {
		await this.redis.eval(
			INCREMENT_PENDING_COUNT_USAGE_SCRIPT,
			1,
			countUsageKey('pending', organizationId, 'snapshot_count'),
			snapshotCount.toString(),
			ORGANIZATION_USAGE_CACHE.TTL_SECONDS.toString()
		);
	}

	async decrementPendingSnapshotUsage(
		organizationId: string,
		snapshotCount?: number
	): Promise<void> {
		await this.decrementPendingCountUsage(
			organizationId,
			'snapshot_count',
			snapshotCount
		);
	}

	async decrementPendingVolumeUsage(
		organizationId: string,
		volumeCount?: number
	): Promise<void> {
		await this.decrementPendingCountUsage(
			organizationId,
			'volume_count',
			volumeCount
		);
	}

	async applyResizeUsageChange(
		organizationId: string,
		sandboxClass: SandboxClass,
		cpuDelta: number,
		memDelta: number,
		diskDelta: number,
		gpuDelta: number
	): Promise<void> {
		const scope: SandboxUsageScope = { organizationId, sandboxClass };
		const deltas: SandboxResourceAmounts = {
			cpu: cpuDelta,
			memory: memDelta,
			disk: diskDelta,
			gpu: gpuDelta,
		};
		for (const resource of SANDBOX_QUOTA_RESOURCES) {
			if (deltas[resource] !== 0) {
				await this.usageCache.updateCurrentSandboxUsage(
					scope,
					resource,
					deltas[resource]
				);
			}
		}
	}

	private async decrementPendingCountUsage(
		organizationId: string,
		quotaType: OrganizationCountQuotaType,
		count?: number
	): Promise<void> {
		await this.redis.eval(
			DECREMENT_PENDING_COUNT_USAGE_SCRIPT,
			1,
			countUsageKey('pending', organizationId, quotaType),
			count?.toString() ?? '0'
		);
	}

	private pendingSandboxKeys(scope: SandboxUsageScope): string[] {
		return SANDBOX_QUOTA_RESOURCES.map((resource) =>
			sandboxUsageKey('pending', scope, resource)
		);
	}

	private async getPendingSandboxIncrementFlags(
		sandboxClass: SandboxClass,
		excludeSandboxId?: string
	): Promise<SandboxIncrementFlags> {
		const excludedSandbox = excludeSandboxId
			? await this.entityManager.findOne(Sandbox, {
					id: excludeSandboxId,
					sandboxClass,
				})
			: null;
		const consumesCompute =
			excludedSandbox !== null &&
			SANDBOX_STATES_CONSUMING_COMPUTE.includes(excludedSandbox.state);
		const consumesDisk =
			excludedSandbox !== null &&
			SANDBOX_STATES_CONSUMING_DISK.includes(excludedSandbox.state);
		return {
			cpu: !consumesCompute,
			memory: !consumesCompute,
			disk: !consumesDisk,
			gpu: !consumesCompute,
		};
	}

	private toReservation(
		status: number,
		exceededResourceNumber: number,
		postReservation: number[],
		flags: SandboxIncrementFlags,
		request: SandboxResourceAmounts
	): SandboxQuotaReservation {
		if (
			(status !== QUOTA_RESERVATION_STATUS.accepted &&
				status !== QUOTA_RESERVATION_STATUS.rejected) ||
			postReservation.length !== SANDBOX_QUOTA_RESOURCES.length ||
			postReservation.some((value) => !Number.isSafeInteger(value) || value < 0)
		) {
			throw new Error('Redis returned an invalid sandbox quota reservation');
		}

		const rejected = status === QUOTA_RESERVATION_STATUS.rejected;
		const exceededResource = rejected
			? SANDBOX_QUOTA_RESOURCES[exceededResourceNumber - 1]
			: null;
		if (rejected && exceededResource === undefined) {
			throw new Error('Redis returned an invalid exceeded quota resource');
		}

		const totalOf = (resource: SandboxQuotaResource) =>
			postReservation[SANDBOX_QUOTA_RESOURCES.indexOf(resource)];
		return {
			cpuIncremented: flags.cpu && request.cpu > 0,
			memoryIncremented: flags.memory && request.memory > 0,
			diskIncremented: flags.disk && request.disk > 0,
			gpuIncremented: flags.gpu && request.gpu > 0,
			exceededResource: exceededResource ?? null,
			postReservation: {
				cpu: totalOf('cpu'),
				memory: totalOf('memory'),
				disk: totalOf('disk'),
				gpu: totalOf('gpu'),
			},
		};
	}
}
