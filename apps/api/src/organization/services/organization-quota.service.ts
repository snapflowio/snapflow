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
import { apiError } from '../../common/utils/error/api-error.util';
import type { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SettingsService } from '../../settings/services/settings.service';
import type { CreateOrganizationQuotaDto } from '../dto/create-organization-quota.dto';
import { OrganizationQuotaDto } from '../dto/organization-quota.dto';
import type { UpdateOrganizationQuotaDto } from '../dto/update-organization-quota.dto';
import { Organization } from '../entities/organization.entity';
import { OrganizationQuota } from '../entities/organization-quota.entity';
import { OrganizationErrorCode } from '../enums/organization-error-code.enum';
import { organizationNotFound } from '../utils/organization-error.util';
import {
	effectiveQuota,
	emptyTierLimits,
	tierClassLimits,
	tieredSandboxClasses,
} from '../utils/quota-tier.util';
import { OrganizationQuotaTierService } from './organization-quota-tier.service';

export interface QuotaTotals {
	cpu: number;
	memory: number;
	disk: number;
	gpu: number;
}

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
		private readonly settings: SettingsService,
		private readonly quotaTiers: OrganizationQuotaTierService
	) {}

	async list(organizationId: string): Promise<OrganizationQuotaDto[]> {
		const custom = await this.customQuotas(organizationId);
		const tiers = await this.quotaTiers.tiers();
		const tier = await this.quotaTiers.heldTier(organizationId);
		const classes = [
			...new Set([
				...tieredSandboxClasses(tiers),
				...custom.map((quota) => quota.sandboxClass),
			]),
		].sort();
		return classes.map(
			(sandboxClass) =>
				new OrganizationQuotaDto(
					effectiveQuota(
						organizationId,
						tierClassLimits(tiers, tier, sandboxClass) ??
							emptyTierLimits(sandboxClass),
						custom.find((quota) => quota.sandboxClass === sandboxClass) ?? null
					)
				)
		);
	}

	async find(
		organizationId: string,
		sandboxClass: SandboxClass
	): Promise<OrganizationQuotaDto | null> {
		const custom = await this.entityManager.findOne(OrganizationQuota, {
			organizationId,
			sandboxClass,
		});
		const tiers = await this.quotaTiers.tiers();
		if (!custom && !tieredSandboxClasses(tiers).includes(sandboxClass)) {
			return null;
		}
		const tier = await this.quotaTiers.heldTier(organizationId);
		return new OrganizationQuotaDto(
			effectiveQuota(
				organizationId,
				tierClassLimits(tiers, tier, sandboxClass) ??
					emptyTierLimits(sandboxClass),
				custom
			)
		);
	}

	async listCustom(organizationId: string): Promise<OrganizationQuotaDto[]> {
		const quotas = await this.customQuotas(organizationId);
		return quotas.map((quota) => new OrganizationQuotaDto(quota));
	}

	async findCustom(
		organizationId: string,
		sandboxClass: SandboxClass
	): Promise<OrganizationQuotaDto | null> {
		const quota = await this.entityManager.findOne(OrganizationQuota, {
			organizationId,
			sandboxClass,
		});
		return quota ? new OrganizationQuotaDto(quota) : null;
	}

	async raise(
		manager: EntityManager,
		organizationId: string,
		sandboxClass: SandboxClass,
		totals: QuotaTotals
	): Promise<void> {
		const quota = await manager.findOne(OrganizationQuota, {
			organizationId,
			sandboxClass,
		});
		if (!quota) {
			manager.persist(
				new OrganizationQuota({
					organizationId,
					sandboxClass,
					totalCpuQuota: totals.cpu,
					totalMemoryQuota: totals.memory,
					totalDiskQuota: totals.disk,
					totalGpuQuota: totals.gpu,
				})
			);
			return;
		}
		quota.totalCpuQuota = Math.max(quota.totalCpuQuota ?? 0, totals.cpu);
		quota.totalMemoryQuota = Math.max(quota.totalMemoryQuota, totals.memory);
		quota.totalDiskQuota = Math.max(quota.totalDiskQuota, totals.disk);
		quota.totalGpuQuota = Math.max(quota.totalGpuQuota, totals.gpu);
	}

	async create(
		organizationId: string,
		createDto: CreateOrganizationQuotaDto
	): Promise<OrganizationQuotaDto> {
		await this.findOrganizationOrFail(organizationId);
		if (await this.findCustom(organizationId, createDto.sandboxClass)) {
			throw new ConflictException(
				apiError(
					OrganizationErrorCode.QUOTA_ALREADY_EXISTS,
					`Organization ${organizationId} already has a quota for sandbox class ${createDto.sandboxClass}. Update the existing quota instead.`
				)
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
		if (changes.totalCpuQuota !== undefined) {
			quota.totalCpuQuota = changes.totalCpuQuota;
		}
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
		await this.entityManager.remove(quota).flush();
	}

	private async findOrganizationOrFail(organizationId: string): Promise<void> {
		const organization = await this.entityManager.findOne(
			Organization,
			{ id: organizationId },
			{ fields: ['id'] }
		);
		if (!organization) {
			throw new NotFoundException(organizationNotFound(organizationId));
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
				apiError(
					OrganizationErrorCode.QUOTA_NOT_FOUND,
					`Organization ${organizationId} has no quota for sandbox class ${sandboxClass}. Create the quota first or choose another class.`
				)
			);
		}
		return quota;
	}

	private customQuotas(organizationId: string): Promise<OrganizationQuota[]> {
		return this.entityManager.find(
			OrganizationQuota,
			{ organizationId },
			{ orderBy: { sandboxClass: 'ASC' } }
		);
	}
}
