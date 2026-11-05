/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import {
	CUSTOM_DOMAIN_STATE,
	type CustomDomainState,
} from '../../networking/constants/exposure.constants';
import { NETWORKING_LIMITS } from '../../networking/constants/networking.constants';
import type { DomainVerificationRecord } from '../../networking/types/networking.types';

const MINIMUM_HOSTNAME_LENGTH = 4;

export class CreateCustomDomainDto {
	@ApiProperty({ example: 'app.example.com' })
	@IsString()
	@MinLength(MINIMUM_HOSTNAME_LENGTH)
	@MaxLength(NETWORKING_LIMITS.maximumHostnameLength)
	hostname: string;
}

export class CustomDomainDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ format: 'uuid' })
	exposureId: string;

	@ApiProperty()
	hostname: string;

	@ApiProperty()
	cnameTarget: string;

	@ApiProperty({ enum: CUSTOM_DOMAIN_STATE, enumName: 'CustomDomainState' })
	state: CustomDomainState;

	@ApiProperty()
	desiredGeneration: number;

	@ApiProperty()
	observedGeneration: number;

	@ApiPropertyOptional({ nullable: true, type: String })
	providerHostnameStatus: string | null;

	@ApiPropertyOptional({ nullable: true, type: String })
	certificateStatus: string | null;

	@ApiProperty({ type: 'array', items: { type: 'object' } })
	verificationRecords: DomainVerificationRecord[];

	@ApiPropertyOptional({ nullable: true, type: String })
	activatedAt: string | null;

	@ApiPropertyOptional({ nullable: true, type: String })
	lastSynchronizedAt: string | null;

	@ApiPropertyOptional({ nullable: true, type: String })
	lastError: string | null;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;
}

export class CustomDomainPageDto extends CursorPageDto<CustomDomainDto> {
	@ApiProperty({ type: CustomDomainDto, isArray: true })
	declare items: CustomDomainDto[];
}
