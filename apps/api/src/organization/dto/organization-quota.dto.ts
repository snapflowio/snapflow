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
import { OrganizationQuota } from '../entities/organization-quota.entity';

@ApiSchema({ name: 'OrganizationQuota' })
export class OrganizationQuotaDto {
	@ApiProperty()
	organizationId: string;

	@ApiProperty({ enum: SandboxClass, enumName: 'SandboxClass' })
	sandboxClass: SandboxClass;

	@ApiProperty({
		type: Number,
		nullable: true,
		description:
			'vCPUs the organization may run at once; the larger of this and its quota tier applies, and null leaves the tier limit',
	})
	totalCpuQuota: number | null;

	@ApiProperty()
	totalMemoryQuota: number;

	@ApiProperty()
	totalDiskQuota: number;

	@ApiProperty()
	totalGpuQuota: number;

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

	constructor(quota: OrganizationQuota) {
		this.organizationId = quota.organizationId;
		this.sandboxClass = quota.sandboxClass;
		this.totalCpuQuota = quota.totalCpuQuota;
		this.totalMemoryQuota = quota.totalMemoryQuota;
		this.totalDiskQuota = quota.totalDiskQuota;
		this.totalGpuQuota = quota.totalGpuQuota;
		if (quota.allowedGpuTypes) {
			this.allowedGpuTypes = quota.allowedGpuTypes;
		}
		this.maxCpuPerSandbox = quota.maxCpuPerSandbox;
		this.maxMemoryPerSandbox = quota.maxMemoryPerSandbox;
		this.maxDiskPerSandbox = quota.maxDiskPerSandbox;
		this.maxDiskPerNonEphemeralSandbox = quota.maxDiskPerNonEphemeralSandbox;
		this.maxCpuPerGpuSandbox = quota.maxCpuPerGpuSandbox;
		this.maxMemoryPerGpuSandbox = quota.maxMemoryPerGpuSandbox;
		this.maxDiskPerGpuSandbox = quota.maxDiskPerGpuSandbox;
	}
}
