/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsDate,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
	Min,
} from 'class-validator';
import { IsSafeDisplayString } from '../../../common/validators/is-safe-string.validator';

const SUSPENSION_REASON_MAX_LENGTH = 500;
const MINIMUM_CLEANUP_GRACE_PERIOD_HOURS = 0;

@ApiSchema({ name: 'OrganizationSuspension' })
export class OrganizationSuspensionDto {
	@ApiPropertyOptional({ description: 'Suspension reason shown to members' })
	@IsOptional()
	@IsString()
	@IsSafeDisplayString()
	@MaxLength(SUSPENSION_REASON_MAX_LENGTH)
	reason?: string;

	@ApiPropertyOptional({
		description: 'Time the suspension ends; omit for an indefinite suspension',
		format: 'date-time',
		type: String,
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	until?: Date;

	@ApiPropertyOptional({
		description:
			'Hours before the sandboxes and snapshots of the organization are stopped',
		minimum: MINIMUM_CLEANUP_GRACE_PERIOD_HOURS,
	})
	@IsOptional()
	@IsInt()
	@Min(MINIMUM_CLEANUP_GRACE_PERIOD_HOURS)
	cleanupGracePeriodHours?: number;
}
