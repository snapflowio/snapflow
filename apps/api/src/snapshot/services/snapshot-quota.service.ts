/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { OrganizationLimitsService } from '../../organization/services/organization-limits.service';
import { OrganizationQuotaService } from '../../organization/services/organization-quota.service';
import { OrganizationQuotaTierService } from '../../organization/services/organization-quota-tier.service';
import { OrganizationStorageCapService } from '../../organization/services/organization-storage-cap.service';
import { OrganizationUsageService } from '../../organization/services/usage/organization-usage.service';
import { getEffectivePerSandboxLimits } from '../../organization/utils/sandbox-limits.util';
import {
	GPU_SNAPSHOT_NOT_ALLOWED_MESSAGE,
	PER_SANDBOX_LIMIT_EXCEEDED_MESSAGE,
	PER_SANDBOX_TIER_LIMIT,
	TOTAL_QUOTA_TIER_LIMIT,
} from '../../sandbox/constants/resource-limit-messages.constants';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SandboxLimitExceededException } from '../../sandbox/exceptions/sandbox-limit-exceeded.exception';
import { perSandboxViolation } from '../../sandbox/utils/per-sandbox-limit.util';

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
		private readonly storageCap: OrganizationStorageCapService,
		private readonly quotaTiers: OrganizationQuotaTierService
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

		const violation = perSandboxViolation(
			{ cpu, memory, disk },
			getEffectivePerSandboxLimits(organizationLimits, quota, (gpu ?? 0) > 0)
		);
		if (violation) {
			throw SandboxLimitExceededException.perSandbox(
				PER_SANDBOX_LIMIT_EXCEEDED_MESSAGE[violation.resource](
					violation.requested,
					violation.maximum,
					await this.quotaTiers.limitHint(
						organizationId,
						sandboxClass,
						PER_SANDBOX_TIER_LIMIT[violation.resource]
					)
				)
			);
		}

		if (gpu && (!quota || quota.totalGpuQuota === 0)) {
			throw SandboxLimitExceededException.quota(
				GPU_SNAPSHOT_NOT_ALLOWED_MESSAGE(
					sandboxClass,
					await this.quotaTiers.limitHint(
						organizationId,
						sandboxClass,
						TOTAL_QUOTA_TIER_LIMIT.gpu
					)
				)
			);
		}

		await this.storageCap.assertAvailable(organizationId);
		await this.organizationUsageService.incrementPendingSnapshotUsage(
			organizationId,
			addedSnapshotCount
		);
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
