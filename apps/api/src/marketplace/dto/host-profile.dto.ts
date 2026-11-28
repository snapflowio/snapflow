/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
	ValidateIf,
} from 'class-validator';
import { IsSafeDisplayString } from '../../common/validators/is-safe-string.validator';
import { HOST_PROFILE_LIMITS } from '../constants/host-profile.constants';
import { MachineTier } from '../enums/machine-tier.enum';

const BASIS_POINTS = {
	type: Number,
	nullable: true,
	description:
		'Mean over the publicly listed machines that have been assessed, in basis points; null before any is',
} as const;

@ApiSchema({ name: 'HostStats' })
export class HostStatsDto {
	@ApiProperty({
		type: 'integer',
		minimum: 0,
		description: 'Machines the host lists publicly in the marketplace',
	})
	listedMachines: number;

	@ApiProperty(BASIS_POINTS)
	uptimeBasisPoints: number | null;

	@ApiProperty(BASIS_POINTS)
	reliabilityBasisPoints: number | null;

	@ApiProperty({
		enum: MachineTier,
		enumName: 'MachineTier',
		nullable: true,
		description:
			'Highest benchmark tier among the publicly listed machines; null without one',
	})
	topTier: MachineTier | null;
}

@ApiSchema({ name: 'HostProfile' })
export class HostProfileDto {
	@ApiProperty({
		description:
			"The name listings show for the host; the organization's name until the host sets one",
	})
	displayName: string;

	@ApiProperty({ type: String, nullable: true })
	description: string | null;

	@ApiProperty({
		type: String,
		nullable: true,
		description:
			'Version of the host terms the organization accepted; null before any',
	})
	hostTermsVersion: string | null;

	@ApiProperty({ type: HostStatsDto })
	stats: HostStatsDto;
}

@ApiSchema({ name: 'UpdateHostProfile' })
export class UpdateHostProfileDto {
	@ApiProperty({
		minLength: HOST_PROFILE_LIMITS.DISPLAY_NAME_MIN_LENGTH,
		maxLength: HOST_PROFILE_LIMITS.DISPLAY_NAME_MAX_LENGTH,
		example: 'Garage Compute',
	})
	@IsString()
	@IsSafeDisplayString()
	@MinLength(HOST_PROFILE_LIMITS.DISPLAY_NAME_MIN_LENGTH)
	@MaxLength(HOST_PROFILE_LIMITS.DISPLAY_NAME_MAX_LENGTH)
	displayName: string;

	@ApiPropertyOptional({
		type: String,
		nullable: true,
		maxLength: HOST_PROFILE_LIMITS.DESCRIPTION_MAX_LENGTH,
		description: 'A short description; null or omitted clears it',
	})
	@IsOptional()
	@ValidateIf((_input, value) => value !== null)
	@IsString()
	@IsSafeDisplayString()
	@MaxLength(HOST_PROFILE_LIMITS.DESCRIPTION_MAX_LENGTH)
	description?: string | null;
}
