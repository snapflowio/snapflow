/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
} from '@nestjs/common';
import { TypedConfigService } from '../../../../config/services/typed-config.service';
import type { OrganizationQuotaDto } from '../../../../organization/tenant/dto/organization-quota.dto';
import { OrganizationQuotaService } from '../../../../organization/tenant/services/organization-quota.service';
import { OrganizationUsageService } from '../../../../organization/tenant/services/organization-usage.service';
import type { SandboxQuotaResource } from '../../../../organization/tenant/utils/organization-usage.util';
import { getEffectivePerSandboxLimits } from '../../../../organization/tenant/utils/sandbox-limits.util';
import {
	ARCHIVE_SANDBOXES_MESSAGE,
	PER_SANDBOX_LIMIT_MESSAGE,
	UPGRADE_TIER_MESSAGE,
} from '../../constants/resource-limit-messages.constants';
import { SandboxClass } from '../../enums/sandbox-class.enum';
import type {
	PendingQuotaReservation,
	SandboxQuotaRequest,
} from '../../types/sandbox-quota.types';

const NO_PENDING_RESERVATION: PendingQuotaReservation = {
	pendingCpuIncremented: false,
	pendingMemoryIncremented: false,
	pendingDiskIncremented: false,
	pendingGpuIncremented: false,
};

const QUOTA_EXCEEDED_MESSAGE = {
	cpu: (quota, upgradeTierMessage) =>
		`Total CPU limit exceeded. Maximum allowed: ${quota.totalCpuQuota}.\n${upgradeTierMessage}`,
	memory: (quota, upgradeTierMessage) =>
		`Total memory limit exceeded. Maximum allowed: ${quota.totalMemoryQuota}GiB.\n${upgradeTierMessage}`,
	disk: (quota, upgradeTierMessage) =>
		`Total disk limit exceeded. Maximum allowed: ${quota.totalDiskQuota}GiB.\n${ARCHIVE_SANDBOXES_MESSAGE}\n${upgradeTierMessage}`,
	gpu: (quota, upgradeTierMessage) =>
		`Total GPU limit exceeded. Maximum allowed: ${quota.totalGpuQuota}.\n${upgradeTierMessage}`,
} as const satisfies Record<
	SandboxQuotaResource,
	(quota: OrganizationQuotaDto, upgradeTierMessage: string) => string
>;

function assertPerSandboxLimits(
	request: SandboxQuotaRequest,
	quota: OrganizationQuotaDto | null | undefined
): void {
	const { cpu, memory, disk, gpu } = request.usage;
	const limits = getEffectivePerSandboxLimits(
		request.organizationLimits,
		quota,
		request.gpuEnabled ?? gpu > 0
	);
	if (cpu > limits.maxCpuPerSandbox) {
		throw new BadRequestException(
			`CPU request ${cpu} exceeds maximum allowed per sandbox (${limits.maxCpuPerSandbox}).\n${PER_SANDBOX_LIMIT_MESSAGE}`
		);
	}
	if (memory > limits.maxMemoryPerSandbox) {
		throw new BadRequestException(
			`Memory request ${memory}GB exceeds maximum allowed per sandbox (${limits.maxMemoryPerSandbox}GB).\n${PER_SANDBOX_LIMIT_MESSAGE}`
		);
	}
	if (disk > limits.maxDiskPerSandbox) {
		throw new BadRequestException(
			`Disk request ${disk}GB exceeds maximum allowed per sandbox (${limits.maxDiskPerSandbox}GB).\n${PER_SANDBOX_LIMIT_MESSAGE}`
		);
	}
	if (!request.ephemeral) {
		assertNonEphemeralDiskLimit(disk, limits.maxDiskPerNonEphemeralSandbox);
	}
}

function assertNonEphemeralDiskLimit(
	disk: number,
	maxDiskPerNonEphemeralSandbox: number | null
): void {
	if (maxDiskPerNonEphemeralSandbox === null) {
		return;
	}
	if (maxDiskPerNonEphemeralSandbox === 0) {
		throw new BadRequestException(
			'Only ephemeral sandboxes are permitted for this organization'
		);
	}
	if (disk > maxDiskPerNonEphemeralSandbox) {
		throw new BadRequestException(
			`Disk request ${disk}GB exceeds maximum allowed per non-ephemeral sandbox (${maxDiskPerNonEphemeralSandbox}GB).\n${PER_SANDBOX_LIMIT_MESSAGE}`
		);
	}
}

@Injectable()
export class SandboxQuotaService {
	private readonly logger = new Logger(SandboxQuotaService.name);

	constructor(
		private readonly quotas: OrganizationQuotaService,
		private readonly organizationUsageService: OrganizationUsageService,
		private readonly configService: TypedConfigService
	) {}

	async validateOrganizationQuotas(
		request: SandboxQuotaRequest
	): Promise<PendingQuotaReservation> {
		if (request.ownMachinesOnly) {
			assertPerSandboxLimits(request, request.quota);
			return NO_PENDING_RESERVATION;
		}
		const quota = await this.resolveQuota(request);
		assertPerSandboxLimits(request, quota);
		return this.reservePending(request, quota);
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

	private async resolveQuota(
		request: SandboxQuotaRequest
	): Promise<OrganizationQuotaDto> {
		const { organizationLimits, sandboxClass } = request;
		const quota =
			request.quota ??
			(await this.quotas.find(organizationLimits.organizationId, sandboxClass));
		if (!quota) {
			throw new ForbiddenException(
				`This organization has no quota for sandbox class ${sandboxClass}`
			);
		}
		return quota;
	}

	private async reservePending(
		request: SandboxQuotaRequest,
		quota: OrganizationQuotaDto
	): Promise<PendingQuotaReservation> {
		if (request.usage.gpu > 0 && quota.totalGpuQuota === 0) {
			throw new BadRequestException(
				`Total GPU limit exceeded. Maximum allowed: ${quota.totalGpuQuota}.`
			);
		}
		const reservation =
			await this.organizationUsageService.reservePendingSandboxUsage(
				request.organizationLimits.organizationId,
				request.sandboxClass,
				request.usage,
				{
					cpu: quota.totalCpuQuota,
					memory: quota.totalMemoryQuota,
					disk: quota.totalDiskQuota,
					gpu: quota.totalGpuQuota,
				},
				request.excludeSandboxId
			);
		if (reservation.exceededResource) {
			throw new BadRequestException(
				QUOTA_EXCEEDED_MESSAGE[reservation.exceededResource](
					quota,
					UPGRADE_TIER_MESSAGE(this.configService.getOrThrow('dashboardUrl'))
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
