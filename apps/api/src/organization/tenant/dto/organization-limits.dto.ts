/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import type { OrganizationLimits } from '../entities/organization-limits.entity';

const NULLABLE_NUMBER = { type: Number, nullable: true } as const;

@ApiSchema({ name: 'OrganizationLimits' })
export class OrganizationLimitsDto {
	@ApiProperty({ format: 'uuid' })
	organizationId: string;

	@ApiProperty()
	maxCpuPerSandbox: number;

	@ApiProperty()
	maxMemoryPerSandbox: number;

	@ApiProperty()
	maxDiskPerSandbox: number;

	@ApiProperty()
	maxSnapshotSize: number;

	@ApiProperty()
	snapshotQuota: number;

	@ApiProperty()
	volumeQuota: number;

	@ApiProperty(NULLABLE_NUMBER)
	authenticatedRateLimit: number | null;

	@ApiProperty(NULLABLE_NUMBER)
	sandboxCreateRateLimit: number | null;

	@ApiProperty(NULLABLE_NUMBER)
	sandboxLifecycleRateLimit: number | null;

	@ApiProperty(NULLABLE_NUMBER)
	authenticatedRateLimitTtlSeconds: number | null;

	@ApiProperty(NULLABLE_NUMBER)
	sandboxCreateRateLimitTtlSeconds: number | null;

	@ApiProperty(NULLABLE_NUMBER)
	sandboxLifecycleRateLimitTtlSeconds: number | null;

	@ApiProperty({
		description: 'Time in minutes before an unused snapshot is deactivated',
	})
	snapshotDeactivationTimeoutMinutes: number;

	@ApiProperty()
	sandboxLimitedNetworkEgress: boolean;

	static from(limits: OrganizationLimits): OrganizationLimitsDto {
		return {
			organizationId: limits.organizationId,
			maxCpuPerSandbox: limits.maxCpuPerSandbox,
			maxMemoryPerSandbox: limits.maxMemoryPerSandbox,
			maxDiskPerSandbox: limits.maxDiskPerSandbox,
			maxSnapshotSize: limits.maxSnapshotSize,
			snapshotQuota: limits.snapshotQuota,
			volumeQuota: limits.volumeQuota,
			authenticatedRateLimit: limits.authenticatedRateLimit,
			sandboxCreateRateLimit: limits.sandboxCreateRateLimit,
			sandboxLifecycleRateLimit: limits.sandboxLifecycleRateLimit,
			authenticatedRateLimitTtlSeconds: limits.authenticatedRateLimitTtlSeconds,
			sandboxCreateRateLimitTtlSeconds: limits.sandboxCreateRateLimitTtlSeconds,
			sandboxLifecycleRateLimitTtlSeconds:
				limits.sandboxLifecycleRateLimitTtlSeconds,
			snapshotDeactivationTimeoutMinutes:
				limits.snapshotDeactivationTimeoutMinutes,
			sandboxLimitedNetworkEgress: limits.sandboxLimitedNetworkEgress,
		};
	}
}
