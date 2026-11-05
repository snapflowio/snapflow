/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsOptional,
	IsString,
	MaxLength,
	ValidateNested,
} from 'class-validator';
import { NETWORKING_LIMITS } from '../../constants/networking.constants';

class CloudflareWebhookZoneDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumVersionLength)
	id?: string;
}

class CloudflareWebhookMetadataDto {
	@ApiPropertyOptional({ type: CloudflareWebhookZoneDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => CloudflareWebhookZoneDto)
	zone?: CloudflareWebhookZoneDto;
}

class CloudflareWebhookDataDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumVersionLength)
	id?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(NETWORKING_LIMITS.maximumHostnameLength)
	hostname?: string;
}

export class CloudflareCustomHostnameWebhookDto {
	@ApiPropertyOptional({ type: CloudflareWebhookMetadataDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => CloudflareWebhookMetadataDto)
	metadata?: CloudflareWebhookMetadataDto;

	@ApiPropertyOptional({ type: CloudflareWebhookDataDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => CloudflareWebhookDataDto)
	data?: CloudflareWebhookDataDto;
}
