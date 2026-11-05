/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';
import { IsSafeDisplayString } from '../../common/validators/is-safe-string.validator';

@ApiSchema({ name: 'UpdateDockerRegistry' })
export class UpdateDockerRegistryDto {
	@ApiProperty({ description: 'Registry name' })
	@IsString()
	@IsSafeDisplayString()
	name: string;

	@ApiProperty({ description: 'Registry URL' })
	@IsUrl()
	url: string;

	@ApiProperty({ description: 'Registry username' })
	@IsString()
	username: string;

	@ApiPropertyOptional({ description: 'Registry password' })
	@IsString()
	@IsOptional()
	password?: string;

	@ApiPropertyOptional({ description: 'Registry project' })
	@IsString()
	@IsOptional()
	project?: string;
}
