/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { OrganizationQuotaDto } from '../../../organization/dto/organization-quota.dto';
import { OrganizationQuotaService } from '../../../organization/services/organization-quota.service';
import { OrganizationQuotaTierService } from '../../../organization/services/organization-quota-tier.service';
import { OrganizationUsageService } from '../../../organization/services/usage/organization-usage.service';
import type { QuotaTierLimitKey } from '../../../organization/types/quota-tier.types';
import { getEffectivePerSandboxLimits } from '../../../organization/utils/sandbox-limits.util';
import {
	PER_SANDBOX_LIMIT_EXCEEDED_MESSAGE,
	PER_SANDBOX_TIER_LIMIT,
	PERSISTENT_DISK_LIMIT_EXCEEDED_MESSAGE,
	QUOTA_EXCEEDED_MESSAGE,
	SANDBOX_CLASS_NOT_ALLOWED_MESSAGE,
	TOTAL_QUOTA_TIER_LIMIT,
} from '../../constants/resource-limit-messages.constants';
import { SandboxClass } from '../../enums/sandbox-class.enum';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import { SandboxLimitExceededException } from '../../exceptions/sandbox-limit-exceeded.exception';
import type {
	PendingQuotaReservation,
	SandboxQuotaRequest,
} from '../../types/sandbox-quota.types';
import {
	type PerSandboxLimits,
	type PerSandboxRequest,
	perSandboxViolation,
} from '../../utils/per-sandbox-limit.util';

const NO_PENDING_RESERVATION: PendingQuotaReservation = {
	pendingCpuIncremented: false,
	pendingMemoryIncremented: false,
	pendingDiskIncremented: false,
	pendingGpuIncremented: false,
};

const NON_EPHEMERAL_SANDBOXES_FORBIDDEN = 0;

export interface PerSandboxLimitCheck {
	organizationId: string;
	sandboxClass: SandboxClass;
	requested: PerSandboxRequest;
	ephemeral: boolean;
	limits: PerSandboxLimits;
}

function assertNonEphemeralDiskLimit(
	disk: number,
	maxDiskPerNonEphemeralSandbox: number | null
): void {
	if (maxDiskPerNonEphemeralSandbox === null) {
		return;
	}
	if (maxDiskPerNonEphemeralSandbox === NON_EPHEMERAL_SANDBOXES_FORBIDDEN) {
		throw SandboxLimitExceededException.persistentNotAllowed();
	}
	if (disk > maxDiskPerNonEphemeralSandbox) {
		throw SandboxLimitExceededException.perSandbox(
			PERSISTENT_DISK_LIMIT_EXCEEDED_MESSAGE(
				disk,
				maxDiskPerNonEphemeralSandbox
			)
		);
	}
}

@Injectable()
export class SandboxQuotaService {
	private readonly logger = new Logger(SandboxQuotaService.name);

	constructor(
		private readonly quotas: OrganizationQuotaService,
		private readonly organizationUsageService: OrganizationUsageService,
		private readonly quotaTiers: OrganizationQuotaTierService
	) {}

	async validateOrganizationQuotas(
		request: SandboxQuotaRequest
	): Promise<PendingQuotaReservation> {
		if (request.ownMachinesOnly) {
			await this.assertRequestPerSandboxLimits(request, request.quota);
			return NO_PENDING_RESERVATION;
		}
		const quota = await this.resolveQuota(request);
		await this.assertRequestPerSandboxLimits(request, quota);
		return this.reservePending(request, quota);
	}

	async assertPerSandboxLimits(check: PerSandboxLimitCheck): Promise<void> {
		const violation = perSandboxViolation(check.requested, check.limits);
		if (violation) {
			throw SandboxLimitExceededException.perSandbox(
				PER_SANDBOX_LIMIT_EXCEEDED_MESSAGE[violation.resource](
					violation.requested,
					violation.maximum,
					await this.tierHint(
						check.organizationId,
						check.sandboxClass,
						PER_SANDBOX_TIER_LIMIT[violation.resource]
					)
				)
			);
		}
		const { disk } = check.requested;
		if (!check.ephemeral && disk !== undefined) {
			assertNonEphemeralDiskLimit(
				disk,
				check.limits.maxDiskPerNonEphemeralSandbox
			);
		}
	}

	async rollbackPendingUsage(
		organizationId: string,
		sandboxClass: SandboxClass,
		pendingCpuIncrement?: number,
		pendingMemoryIncrement?: number,
		pendingDiskIncrement?: number,
		pendingGpuIncrement?: number
	): Promise<void> {
		if (
			!pendingCpuIncrement &&
			!pendingMemoryIncrement &&
			!pendingDiskIncrement &&
			!pendingGpuIncrement
		) {
			return;
		}

		try {
			await this.organizationUsageService.decrementPendingSandboxUsage(
				organizationId,
				sandboxClass,
				pendingCpuIncrement,
				pendingMemoryIncrement,
				pendingDiskIncrement,
				pendingGpuIncrement
			);
		} catch (error) {
			this.logger.error(`Error rolling back pending sandbox usage: ${error}`);
		}
	}

	private assertRequestPerSandboxLimits(
		request: SandboxQuotaRequest,
		quota: OrganizationQuotaDto | null | undefined
	): Promise<void> {
		const { cpu, memory, disk, gpu } = request.usage;
		return this.assertPerSandboxLimits({
			organizationId: request.organizationLimits.organizationId,
			sandboxClass: request.sandboxClass,
			requested: { cpu, memory, disk },
			ephemeral: request.ephemeral,
			limits: getEffectivePerSandboxLimits(
				request.organizationLimits,
				quota,
				request.gpuEnabled ?? gpu > 0
			),
		});
	}

	private tierHint(
		organizationId: string,
		sandboxClass: SandboxClass,
		limit: QuotaTierLimitKey
	): Promise<string> {
		return this.quotaTiers.limitHint(organizationId, sandboxClass, limit);
	}

	private async resolveQuota(
		request: SandboxQuotaRequest
	): Promise<OrganizationQuotaDto> {
		const { organizationLimits, sandboxClass } = request;
		const quota =
			request.quota ??
			(await this.quotas.find(organizationLimits.organizationId, sandboxClass));
		if (!quota) {
			throw new ForbiddenException({
				code: SandboxErrorCode.CLASS_NOT_ALLOWED,
				message: SANDBOX_CLASS_NOT_ALLOWED_MESSAGE(sandboxClass),
			});
		}
		return quota;
	}

	private async reservePending(
		request: SandboxQuotaRequest,
		quota: OrganizationQuotaDto
	): Promise<PendingQuotaReservation> {
		const { organizationId } = request.organizationLimits;
		const limits = {
			cpu: quota.totalCpuQuota ?? 0,
			memory: quota.totalMemoryQuota,
			disk: quota.totalDiskQuota,
			gpu: quota.totalGpuQuota,
		};
		if (request.usage.gpu > 0 && limits.gpu === 0) {
			throw SandboxLimitExceededException.quota(
				QUOTA_EXCEEDED_MESSAGE.gpu(
					limits.gpu,
					await this.tierHint(
						organizationId,
						request.sandboxClass,
						TOTAL_QUOTA_TIER_LIMIT.gpu
					)
				)
			);
		}
		const reservation =
			await this.organizationUsageService.reservePendingSandboxUsage(
				organizationId,
				request.sandboxClass,
				request.usage,
				limits,
				request.excludeSandboxId
			);
		const exceeded = reservation.exceededResource;
		if (exceeded) {
			throw SandboxLimitExceededException.quota(
				QUOTA_EXCEEDED_MESSAGE[exceeded](
					limits[exceeded],
					await this.tierHint(
						organizationId,
						request.sandboxClass,
						TOTAL_QUOTA_TIER_LIMIT[exceeded]
					)
				)
			);
		}
		return {
			pendingCpuIncremented: reservation.cpuIncremented,
			pendingMemoryIncremented: reservation.memoryIncremented,
			pendingDiskIncremented: reservation.diskIncremented,
			pendingGpuIncremented: reservation.gpuIncremented,
		};
	}
}
