/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

@ApiSchema({ name: 'OrganizationSettings' })
export class OrganizationSettingsDto {
	@ApiProperty()
	telemetryEnabled: boolean;

	@ApiProperty({ description: 'Limit network egress of new sandboxes' })
	sandboxLimitedNetworkEgress: boolean;
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
}
