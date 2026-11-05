/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { IsSafeDisplayString } from '../../common/validators/is-safe-string.validator';

const REGISTRY_URL_OPTIONS = {
	protocols: ['http', 'https'],
	require_protocol: true,
	require_tld: false,
};

@ApiSchema({ name: 'AdminCreateDockerRegistry' })
export class AdminCreateDockerRegistryDto {
	@ApiProperty({ description: 'Registry name' })
	@IsString()
	@IsSafeDisplayString()
	name: string;

	@ApiProperty({ description: 'Registry URL' })
	@IsUrl(REGISTRY_URL_OPTIONS)
	url: string;

	@ApiProperty({ description: 'Registry username' })
	@IsString()
	@IsNotEmpty()
	username: string;

	@ApiProperty({ description: 'Registry password' })
	@IsString()
	@IsNotEmpty()
	password: string;

	@ApiPropertyOptional({ description: 'Registry project' })
	@IsOptional()
	@IsString()
	project?: string;
}

@ApiSchema({ name: 'AdminUpdateDockerRegistry' })
export class AdminUpdateDockerRegistryDto {
	@ApiProperty({ description: 'Registry name' })
	@IsString()
	@IsSafeDisplayString()
	name: string;

	@ApiProperty({ description: 'Registry URL' })
	@IsUrl(REGISTRY_URL_OPTIONS)
	url: string;

	@ApiProperty({ description: 'Registry username' })
	@IsString()
	@IsNotEmpty()
	username: string;

	@ApiPropertyOptional({ description: 'New password; omit to keep it' })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	password?: string;

	@ApiPropertyOptional({ description: 'Registry project' })
	@IsOptional()
	@IsString()
	project?: string;
}
