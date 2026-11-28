/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ARCHIVE_AFTER_STOPPED_DAYS } from '../../settings/constants/settings.constants';
import {
	ORGANIZATION_LIMIT_MINIMUM,
	STORAGE_CAP_GIB_MINIMUM,
} from '../constants/organization-limits.constants';

@ApiSchema({ name: 'UpdateOrganizationLimits' })
export class UpdateOrganizationLimitsDto {
	@ApiPropertyOptional()
	@IsInt()
	@Min(ORGANIZATION_LIMIT_MINIMUM)
	@IsOptional()
	maxCpuPerSandbox?: number;

	@ApiPropertyOptional()
	@IsInt()
	@Min(ORGANIZATION_LIMIT_MINIMUM)
	@IsOptional()
	maxMemoryPerSandbox?: number;

	@ApiPropertyOptional()
	@IsInt()
	@Min(ORGANIZATION_LIMIT_MINIMUM)
	@IsOptional()
	maxDiskPerSandbox?: number;

	@ApiPropertyOptional({
		type: Number,
		nullable: true,
		description:
			'GiB of Snapflow storage the organization may keep; null restores the platform default',
	})
	@IsInt()
	@Min(STORAGE_CAP_GIB_MINIMUM)
	@IsOptional()
	storageCapGib?: number | null;

	@ApiPropertyOptional({
		type: 'integer',
		nullable: true,
		minimum: ARCHIVE_AFTER_STOPPED_DAYS.MINIMUM,
		maximum: ARCHIVE_AFTER_STOPPED_DAYS.MAXIMUM,
		description:
			'Days a stopped sandbox stays on its machine before it is archived; 0 archives it once its stop backup completed, null restores the platform default',
	})
	@IsInt()
	@Min(ARCHIVE_AFTER_STOPPED_DAYS.MINIMUM)
	@Max(ARCHIVE_AFTER_STOPPED_DAYS.MAXIMUM)
	@IsOptional()
	archiveAfterStoppedDays?: number | null;

	@ApiPropertyOptional()
	@IsInt()
	@Min(ORGANIZATION_LIMIT_MINIMUM)
	@IsOptional()
	authenticatedRateLimit?: number;

	@ApiPropertyOptional()
	@IsInt()
	@Min(ORGANIZATION_LIMIT_MINIMUM)
	@IsOptional()
	sandboxCreateRateLimit?: number;

	@ApiPropertyOptional()
	@IsInt()
	@Min(ORGANIZATION_LIMIT_MINIMUM)
	@IsOptional()
	sandboxLifecycleRateLimit?: number;

	@ApiPropertyOptional()
	@IsInt()
	@Min(ORGANIZATION_LIMIT_MINIMUM)
	@IsOptional()
	authenticatedRateLimitTtlSeconds?: number;

	@ApiPropertyOptional()
	@IsInt()
	@Min(ORGANIZATION_LIMIT_MINIMUM)
	@IsOptional()
	sandboxCreateRateLimitTtlSeconds?: number;

	@ApiPropertyOptional()
	@IsInt()
	@Min(ORGANIZATION_LIMIT_MINIMUM)
	@IsOptional()
	sandboxLifecycleRateLimitTtlSeconds?: number;

	@ApiPropertyOptional({
		description: 'Time in minutes before an unused snapshot is deactivated',
	})
	@IsInt()
	@Min(ORGANIZATION_LIMIT_MINIMUM)
	@IsOptional()
	snapshotDeactivationTimeoutMinutes?: number;

	@ApiPropertyOptional({
		description: 'Limit network egress of new sandboxes by default',
	})
	@IsBoolean()
	@IsOptional()
	sandboxLimitedNetworkEgress?: boolean;
}
