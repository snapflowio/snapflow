/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OrganizationLimitsService } from '../../organization/services/organization-limits.service';
import { OrganizationQuotaService } from '../../organization/services/organization-quota.service';
import { OrganizationUsageService } from '../../organization/services/organization-usage.service';
import { OrganizationUsageOverviewService } from '../../organization/services/organization-usage-overview.service';
import { getEffectivePerSandboxLimits } from '../../organization/utils/sandbox-limits.util';
import { PER_SANDBOX_LIMIT_MESSAGE } from '../../sandbox/constants/resource-limit-messages.constants';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';

type SnapshotResourceRequest = Readonly<{
	cpu?: number;
	memory?: number;
	disk?: number;
	gpu?: number;
}>;

@Injectable()
export class SnapshotQuotaService {
	private readonly logger = new Logger(SnapshotQuotaService.name);

	constructor(
		private readonly organizationLimitsService: OrganizationLimitsService,
		private readonly quotas: OrganizationQuotaService,
		private readonly organizationUsageService: OrganizationUsageService,
		private readonly organizationUsageOverviewService: OrganizationUsageOverviewService
	) {}

	async reserve(
		organizationId: string,
		sandboxClass: SandboxClass,
		addedSnapshotCount: number,
		{ cpu, memory, disk, gpu }: SnapshotResourceRequest
	): Promise<void> {
		const organizationLimits =
			await this.organizationLimitsService.get(organizationId);
		const quota = await this.quotas.find(organizationId, sandboxClass);

		const { maxCpuPerSandbox, maxMemoryPerSandbox, maxDiskPerSandbox } =
			getEffectivePerSandboxLimits(organizationLimits, quota, (gpu ?? 0) > 0);

		if (cpu && cpu > maxCpuPerSandbox) {
			throw new BadRequestException(
				`CPU request ${cpu} exceeds maximum allowed per sandbox (${maxCpuPerSandbox}).\n${PER_SANDBOX_LIMIT_MESSAGE}`
			);
		}
		if (memory && memory > maxMemoryPerSandbox) {
			throw new BadRequestException(
				`Memory request ${memory}GB exceeds maximum allowed per sandbox (${maxMemoryPerSandbox}GB).\n${PER_SANDBOX_LIMIT_MESSAGE}`
			);
		}
		if (disk && disk > maxDiskPerSandbox) {
			throw new BadRequestException(
				`Disk request ${disk}GB exceeds maximum allowed per sandbox (${maxDiskPerSandbox}GB).\n${PER_SANDBOX_LIMIT_MESSAGE}`
			);
		}

		if (gpu && (!quota || quota.totalGpuQuota === 0)) {
			throw new BadRequestException(
				`GPU quota exceeded. Maximum allowed: ${quota?.totalGpuQuota ?? 0}.`
			);
		}

		await this.organizationUsageService.incrementPendingSnapshotUsage(
			organizationId,
			addedSnapshotCount
		);

		const usageOverview =
			await this.organizationUsageOverviewService.getSnapshotUsageOverview(
				organizationId
			);
		if (
			usageOverview.currentSnapshotUsage +
				(usageOverview.pendingSnapshotUsage ?? 0) >
			organizationLimits.snapshotQuota
		) {
			await this.release(organizationId, addedSnapshotCount);
			throw new BadRequestException(
				`Snapshot quota exceeded. Maximum allowed: ${organizationLimits.snapshotQuota}`
			);
		}
	}

	async release(
		organizationId: string,
		reservedSnapshotCount: number | undefined
	): Promise<void> {
		if (!reservedSnapshotCount) {
			return;
		}

		try {
			await this.organizationUsageService.decrementPendingSnapshotUsage(
				organizationId,
				reservedSnapshotCount
			);
		} catch (error) {
			this.logger.error(`Error rolling back pending snapshot usage: ${error}`);
		}
	}
}
