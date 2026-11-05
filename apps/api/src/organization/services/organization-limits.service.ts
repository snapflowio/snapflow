/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { SettingsService } from '../../settings/services/settings.service';
import { organizationRateLimitsCacheKey } from '../constants/organization-limits.constants';
import type { UpdateOrganizationLimitsDto } from '../dto/update-organization-limits.dto';
import { Organization } from '../entities/organization.entity';
import { OrganizationLimits } from '../entities/organization-limits.entity';

@Injectable()
export class OrganizationLimitsService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		@InjectRedis() private readonly redis: Redis
	) {}

	async get(organizationId: string): Promise<OrganizationLimits> {
		return (
			(await this.entityManager.findOne(OrganizationLimits, {
				organizationId,
			})) ?? this.defaults(organizationId)
		);
	}

	async update(
		organizationId: string,
		dto: UpdateOrganizationLimitsDto
	): Promise<OrganizationLimits> {
		const limits = await this.entityManager.transactional(async (manager) => {
			const organization = await manager.findOne(
				Organization,
				{ id: organizationId },
				{ fields: ['id'] }
			);
			if (!organization) {
				throw new NotFoundException(`Organization ${organizationId} not found`);
			}
			const stored = await manager.findOne(OrganizationLimits, {
				organizationId,
			});
			const current = stored ?? (await this.defaults(organizationId));
			if (!stored) manager.persist(current);
			manager.assign(current, dto);
			return current;
		});
		await this.redis.del(organizationRateLimitsCacheKey(organizationId));
		return limits;
	}

	private async defaults(organizationId: string): Promise<OrganizationLimits> {
		const settings = await this.settings.get();
		return new OrganizationLimits(organizationId, {
			maxCpuPerSandbox: settings.maxCpuPerSandbox,
			maxMemoryPerSandbox: settings.maxMemoryPerSandbox,
			maxDiskPerSandbox: settings.maxDiskPerSandbox,
			maxSnapshotSize: settings.maxSnapshotSize,
			snapshotQuota: settings.snapshotQuota,
			volumeQuota: settings.volumeQuota,
			sandboxLimitedNetworkEgress: settings.sandboxDefaultLimitedNetworkEgress,
		});
	}
}
