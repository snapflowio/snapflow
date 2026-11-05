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
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import type { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SettingsService } from '../../settings/services/settings.service';
import type { CreateOrganizationQuotaDto } from '../dto/create-organization-quota.dto';
import { OrganizationQuotaDto } from '../dto/organization-quota.dto';
import type { UpdateOrganizationQuotaDto } from '../dto/update-organization-quota.dto';
import { Organization } from '../entities/organization.entity';
import { OrganizationQuota } from '../entities/organization-quota.entity';

const MINIMUM_ORGANIZATION_QUOTAS = 1;
const NULLABLE_QUOTA_FIELDS = [
	'maxCpuPerSandbox',
	'maxMemoryPerSandbox',
	'maxDiskPerSandbox',
	'maxDiskPerNonEphemeralSandbox',
	'maxCpuPerGpuSandbox',
	'maxMemoryPerGpuSandbox',
	'maxDiskPerGpuSandbox',
] as const;

@Injectable()
export class OrganizationQuotaService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService
	) {}

	async list(organizationId: string): Promise<OrganizationQuotaDto[]> {
		const quotas = await this.entityManager.find(
			OrganizationQuota,
			{ organizationId },
			{ orderBy: { sandboxClass: 'ASC' } }
		);
		return quotas.map((quota) => new OrganizationQuotaDto(quota));
	}

	async find(
		organizationId: string,
		sandboxClass: SandboxClass
	): Promise<OrganizationQuotaDto | null> {
		const quota = await this.entityManager.findOne(OrganizationQuota, {
			organizationId,
			sandboxClass,
		});
		return quota ? new OrganizationQuotaDto(quota) : null;
	}

	async create(
		organizationId: string,
		createDto: CreateOrganizationQuotaDto
	): Promise<OrganizationQuotaDto> {
		await this.findOrganizationOrFail(organizationId);
		if (await this.find(organizationId, createDto.sandboxClass)) {
			throw new ConflictException(
				`Quota for organization ${organizationId}, sandbox class ${createDto.sandboxClass} already exists`
			);
		}

		const quota = new OrganizationQuota({
			organizationId,
			sandboxClass: createDto.sandboxClass,
			totalCpuQuota: createDto.totalCpuQuota,
			totalMemoryQuota: createDto.totalMemoryQuota,
			totalDiskQuota: createDto.totalDiskQuota,
			totalGpuQuota: createDto.totalGpuQuota,
			allowedGpuTypes: createDto.allowedGpuTypes ?? null,
			maxCpuPerSandbox: createDto.maxCpuPerSandbox ?? null,
			maxMemoryPerSandbox: createDto.maxMemoryPerSandbox ?? null,
			maxDiskPerSandbox: createDto.maxDiskPerSandbox ?? null,
			maxDiskPerNonEphemeralSandbox:
				createDto.maxDiskPerNonEphemeralSandbox ?? null,
			maxCpuPerGpuSandbox: createDto.maxCpuPerGpuSandbox ?? null,
			maxMemoryPerGpuSandbox: createDto.maxMemoryPerGpuSandbox ?? null,
			maxDiskPerGpuSandbox: createDto.maxDiskPerGpuSandbox ?? null,
		});
		await this.entityManager.persist(quota).flush();
		return new OrganizationQuotaDto(quota);
	}

	async update(
		organizationId: string,
		updateDto: UpdateOrganizationQuotaDto
	): Promise<void> {
		const { sandboxClass, ...changes } = updateDto;
		const quota = await this.findQuotaOrFail(
			organizationId,
			sandboxClass ?? (await this.settings.get()).defaultSandboxClass
		);
		quota.totalCpuQuota = changes.totalCpuQuota ?? quota.totalCpuQuota;
		quota.totalMemoryQuota = changes.totalMemoryQuota ?? quota.totalMemoryQuota;
		quota.totalDiskQuota = changes.totalDiskQuota ?? quota.totalDiskQuota;
		quota.totalGpuQuota = changes.totalGpuQuota ?? quota.totalGpuQuota;
		if (changes.allowedGpuTypes !== undefined) {
			quota.allowedGpuTypes = changes.allowedGpuTypes;
		}
		for (const field of NULLABLE_QUOTA_FIELDS) {
			const value = changes[field];
			if (value !== undefined) quota[field] = value;
		}
		await this.entityManager.flush();
	}

	async delete(
		organizationId: string,
		sandboxClass: SandboxClass
	): Promise<void> {
		const quota = await this.findQuotaOrFail(organizationId, sandboxClass);
		if (
			(await this.entityManager.count(OrganizationQuota, { organizationId })) <=
			MINIMUM_ORGANIZATION_QUOTAS
		) {
			throw new ConflictException(
				'The organization must keep at least one quota'
			);
		}
		await this.entityManager.remove(quota).flush();
	}

	async assignPlatformDefaults(
		organizationId: string,
		manager: EntityManager = this.entityManager
	): Promise<void> {
		const settings = await this.settings.get();
		const existing = await manager.count(OrganizationQuota, {
			organizationId,
			sandboxClass: settings.defaultSandboxClass,
		});
		if (existing > 0) return;
		manager.persist(
			new OrganizationQuota({
				organizationId,
				sandboxClass: settings.defaultSandboxClass,
				totalCpuQuota: settings.totalCpuQuota,
				totalMemoryQuota: settings.totalMemoryQuota,
				totalDiskQuota: settings.totalDiskQuota,
			})
		);
		await manager.flush();
	}

	private async findOrganizationOrFail(organizationId: string): Promise<void> {
		const organization = await this.entityManager.findOne(
			Organization,
			{ id: organizationId },
			{ fields: ['id'] }
		);
		if (!organization) {
			throw new NotFoundException(`Organization ${organizationId} not found`);
		}
	}

	private async findQuotaOrFail(
		organizationId: string,
		sandboxClass: SandboxClass
	): Promise<OrganizationQuota> {
		const quota = await this.entityManager.findOne(OrganizationQuota, {
			organizationId,
			sandboxClass,
		});
		if (!quota) {
			throw new NotFoundException(
				`Quota for organization ${organizationId}, sandbox class ${sandboxClass} not found`
			);
		}
		return quota;
	}
}
