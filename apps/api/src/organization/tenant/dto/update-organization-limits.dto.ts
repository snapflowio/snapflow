/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

@ApiSchema({ name: 'UpdateOrganizationLimits' })
export class UpdateOrganizationLimitsDto {
	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	maxCpuPerSandbox?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	maxMemoryPerSandbox?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	maxDiskPerSandbox?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	snapshotQuota?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	maxSnapshotSize?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	volumeQuota?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	authenticatedRateLimit?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	sandboxCreateRateLimit?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	sandboxLifecycleRateLimit?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	authenticatedRateLimitTtlSeconds?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	sandboxCreateRateLimitTtlSeconds?: number;

	@ApiPropertyOptional()
	@IsNumber()
	@IsOptional()
	sandboxLifecycleRateLimitTtlSeconds?: number;

	@ApiPropertyOptional({
		description: 'Time in minutes before an unused snapshot is deactivated',
	})
	@IsNumber()
	@IsOptional()
	snapshotDeactivationTimeoutMinutes?: number;

	@ApiPropertyOptional({
		description: 'Limit network egress of new sandboxes by default',
	})
	@IsBoolean()
	@IsOptional()
	sandboxLimitedNetworkEgress?: boolean;
}
