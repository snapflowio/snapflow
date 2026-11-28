/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ARCHIVE_AFTER_STOPPED_DAYS } from '../../settings/constants/settings.constants';

const ARCHIVE_AFTER_STOPPED_DAYS_DESCRIPTION =
	'Days a stopped sandbox stays on its machine before it is archived to Snapflow storage; 0 archives it once its stop backup completed';

@ApiSchema({ name: 'OrganizationSettings' })
export class OrganizationSettingsDto {
	@ApiProperty()
	telemetryEnabled: boolean;

	@ApiProperty({ description: 'Limit network egress of new sandboxes' })
	sandboxLimitedNetworkEgress: boolean;

	@ApiProperty({
		type: 'integer',
		minimum: ARCHIVE_AFTER_STOPPED_DAYS.MINIMUM,
		maximum: ARCHIVE_AFTER_STOPPED_DAYS.MAXIMUM,
		description: ARCHIVE_AFTER_STOPPED_DAYS_DESCRIPTION,
	})
	archiveAfterStoppedDays: number;
}

@ApiSchema({ name: 'UpdateOrganizationSettings' })
export class UpdateOrganizationSettingsDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	telemetryEnabled?: boolean;

	@ApiPropertyOptional({ description: 'Limit network egress of new sandboxes' })
	@IsOptional()
	@IsBoolean()
	sandboxLimitedNetworkEgress?: boolean;

	@ApiPropertyOptional({
		type: 'integer',
		minimum: ARCHIVE_AFTER_STOPPED_DAYS.MINIMUM,
		maximum: ARCHIVE_AFTER_STOPPED_DAYS.MAXIMUM,
		description: ARCHIVE_AFTER_STOPPED_DAYS_DESCRIPTION,
	})
	@IsOptional()
	@IsInt()
	@Min(ARCHIVE_AFTER_STOPPED_DAYS.MINIMUM)
	@Max(ARCHIVE_AFTER_STOPPED_DAYS.MAXIMUM)
	archiveAfterStoppedDays?: number;
}
