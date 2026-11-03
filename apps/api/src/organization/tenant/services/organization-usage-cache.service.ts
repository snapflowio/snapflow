/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { ORGANIZATION_USAGE_CACHE } from '../constants/organization-usage-cache.constants';
import { UPDATE_CURRENT_USAGE_SCRIPT } from '../constants/organization-usage-redis-scripts.constants';
import type {
	PendingSandboxUsageOverviewInternalDto,
	SandboxUsageOverviewInternalDto,
	SandboxUsageOverviewWithPendingInternalDto,
} from '../dto/sandbox-usage-overview-internal.dto';
import {
	type OrganizationCountQuotaType,
	type OrganizationCountResourceType,
	type OrganizationUsageResourceType,
	SANDBOX_QUOTA_RESOURCES,
	type SandboxQuotaResource,
	type SandboxResourceAmounts,
	type SandboxUsageScope,
} from '../utils/organization-usage.util';
import {
	countUsageKey,
	parseNonNegativeCachedValue,
	sandboxUsageKey,
	usageFetchedAtKey,
} from '../utils/organization-usage-cache.util';

export interface CachedCountUsage {
	current: number;
	pending: number | null;
}

@Injectable()
export class OrganizationUsageCacheService {
	constructor(@InjectRedis() private readonly redis: Redis) {}

	async readSandboxUsage(
		scope: SandboxUsageScope
	): Promise<SandboxUsageOverviewWithPendingInternalDto | null> {
		const values = await this.redis.mget(
			...this.sandboxKeys('current', scope),
			...this.sandboxKeys('pending', scope)
		);
		const currentValues = values.slice(0, SANDBOX_QUOTA_RESOURCES.length);
		if (currentValues.some((value) => value === null)) {
			return null;
		}
		if (await this.isStale(scope.organizationId, 'sandbox', scope)) {
			return null;
		}

		const [cpu, memory, disk, gpu] = currentValues.map(
			parseNonNegativeCachedValue
		);
		if (cpu === null || memory === null || disk === null || gpu === null) {
			return null;
		}

		return {
			currentCpuUsage: cpu,
			currentMemoryUsage: memory,
			currentDiskUsage: disk,
			currentGpuUsage: gpu,
			...this.toPendingSandboxUsage(
				values.slice(SANDBOX_QUOTA_RESOURCES.length)
			),
		};
	}

	async readPendingSandboxUsage(
		scope: SandboxUsageScope
	): Promise<PendingSandboxUsageOverviewInternalDto> {
		return this.toPendingSandboxUsage(
			await this.redis.mget(...this.sandboxKeys('pending', scope))
		);
	}

	async readCountUsage(
		organizationId: string,
		quotaType: OrganizationCountQuotaType,
		resourceType: OrganizationCountResourceType
	): Promise<CachedCountUsage | null> {
		const [current, pending] = await this.redis.mget(
			countUsageKey('current', organizationId, quotaType),
			countUsageKey('pending', organizationId, quotaType)
		);
		if (current === null) {
			return null;
		}
		if (await this.isStale(organizationId, resourceType)) {
			return null;
		}

		const parsedCurrent = parseNonNegativeCachedValue(current);
		if (parsedCurrent === null) {
			return null;
		}

		return {
			current: parsedCurrent,
			pending: parseNonNegativeCachedValue(pending),
		};
	}

	async readPendingCountUsage(
		organizationId: string,
		quotaType: OrganizationCountQuotaType
	): Promise<number | null> {
		return parseNonNegativeCachedValue(
			await this.redis.get(countUsageKey('pending', organizationId, quotaType))
		);
	}

	async writeSandboxUsage(
		scope: SandboxUsageScope,
		usage: SandboxUsageOverviewInternalDto
	): Promise<void> {
		const amounts: SandboxResourceAmounts = {
			cpu: usage.currentCpuUsage,
			memory: usage.currentMemoryUsage,
			disk: usage.currentDiskUsage,
			gpu: usage.currentGpuUsage,
		};
		const transaction = this.redis.multi();
		for (const resource of SANDBOX_QUOTA_RESOURCES) {
			transaction.setex(
				sandboxUsageKey('current', scope, resource),
				ORGANIZATION_USAGE_CACHE.TTL_SECONDS,
				amounts[resource]
			);
		}
		await transaction.exec();
		await this.resetStaleness(scope.organizationId, 'sandbox', scope);
	}

	async writeCountUsage(
		organizationId: string,
		quotaType: OrganizationCountQuotaType,
		resourceType: OrganizationCountResourceType,
		count: number
	): Promise<void> {
		await this.redis.setex(
			countUsageKey('current', organizationId, quotaType),
			ORGANIZATION_USAGE_CACHE.TTL_SECONDS,
			count
		);
		await this.resetStaleness(organizationId, resourceType);
	}

	async updateCurrentSandboxUsage(
		scope: SandboxUsageScope,
		resource: SandboxQuotaResource,
		delta: number
	): Promise<void> {
		await this.updateCurrentUsage(
			sandboxUsageKey('current', scope, resource),
			sandboxUsageKey('pending', scope, resource),
			delta
		);
	}

	async updateCurrentCountUsage(
		organizationId: string,
		quotaType: OrganizationCountQuotaType,
		delta: number
	): Promise<void> {
		await this.updateCurrentUsage(
			countUsageKey('current', organizationId, quotaType),
			countUsageKey('pending', organizationId, quotaType),
			delta
		);
	}

	private async updateCurrentUsage(
		currentKey: string,
		pendingKey: string,
		delta: number
	): Promise<void> {
		await this.redis.eval(
			UPDATE_CURRENT_USAGE_SCRIPT,
			2,
			currentKey,
			pendingKey,
			delta.toString(),
			ORGANIZATION_USAGE_CACHE.TTL_SECONDS.toString()
		);
	}

	private sandboxKeys(
		kind: 'current' | 'pending',
		scope: SandboxUsageScope
	): string[] {
		return SANDBOX_QUOTA_RESOURCES.map((resource) =>
			sandboxUsageKey(kind, scope, resource)
		);
	}

	private toPendingSandboxUsage([cpu, memory, disk, gpu]: (
		| string
		| null
	)[]): PendingSandboxUsageOverviewInternalDto {
		return {
			pendingCpuUsage: parseNonNegativeCachedValue(cpu),
			pendingMemoryUsage: parseNonNegativeCachedValue(memory),
			pendingDiskUsage: parseNonNegativeCachedValue(disk),
			pendingGpuUsage: parseNonNegativeCachedValue(gpu),
		};
	}

	private async resetStaleness(
		organizationId: string,
		resourceType: OrganizationUsageResourceType,
		scope?: SandboxUsageScope
	): Promise<void> {
		await this.redis.set(
			usageFetchedAtKey(organizationId, resourceType, scope),
			Date.now()
		);
	}

	private async isStale(
		organizationId: string,
		resourceType: OrganizationUsageResourceType,
		scope?: SandboxUsageScope
	): Promise<boolean> {
		const cachedData = await this.redis.get(
			usageFetchedAtKey(organizationId, resourceType, scope)
		);
		if (!cachedData) {
			return true;
		}

		const lastFetchedAtTimestamp = Number(cachedData);
		if (Number.isNaN(lastFetchedAtTimestamp)) {
			return true;
		}

		return (
			Date.now() - lastFetchedAtTimestamp >
			ORGANIZATION_USAGE_CACHE.MAX_AGE_MILLISECONDS
		);
	}
}
