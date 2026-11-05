/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';

@ApiSchema({ name: 'QuotaUsageOverview' })
export class QuotaUsageOverviewDto {
	@ApiProperty({ enum: SandboxClass, enumName: 'SandboxClass' })
	sandboxClass: SandboxClass;

	@ApiProperty()
	totalCpuQuota: number;
	@ApiProperty()
	currentCpuUsage: number;

	@ApiProperty()
	totalMemoryQuota: number;
	@ApiProperty()
	currentMemoryUsage: number;

	@ApiProperty()
	totalDiskQuota: number;
	@ApiProperty()
	currentDiskUsage: number;

	@ApiProperty()
	totalGpuQuota: number;
	@ApiProperty()
	currentGpuUsage: number;

	@ApiPropertyOptional({ enum: GpuType, enumName: 'GpuType', isArray: true })
	allowedGpuTypes?: GpuType[];

	@ApiProperty({ type: Number, nullable: true })
	maxCpuPerSandbox: number | null;

	@ApiProperty({ type: Number, nullable: true })
	maxMemoryPerSandbox: number | null;

	@ApiProperty({ type: Number, nullable: true })
	maxDiskPerSandbox: number | null;

	@ApiProperty({ type: Number, nullable: true })
	maxDiskPerNonEphemeralSandbox: number | null;

	@ApiProperty({ type: Number, nullable: true })
	maxCpuPerGpuSandbox: number | null;

	@ApiProperty({ type: Number, nullable: true })
	maxMemoryPerGpuSandbox: number | null;

	@ApiProperty({ type: Number, nullable: true })
	maxDiskPerGpuSandbox: number | null;
}

@ApiSchema({ name: 'OrganizationUsageOverview' })
export class OrganizationUsageOverviewDto {
	@ApiProperty({
		type: [QuotaUsageOverviewDto],
	})
	quotaUsage: QuotaUsageOverviewDto[];

	@ApiProperty()
	totalSnapshotQuota: number;
	@ApiProperty()
	currentSnapshotUsage: number;

	@ApiProperty()
	totalVolumeQuota: number;
	@ApiProperty()
	currentVolumeUsage: number;
}
