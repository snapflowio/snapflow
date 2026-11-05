/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsDateString,
	IsEnum,
	IsOptional,
	IsString,
	MaxLength,
	ValidateNested,
} from 'class-validator';
import { MachineUpdatePhase } from '../enums/machine-update-phase.enum';
import type {
	MachineReleaseSummary,
	MachineUpdateStatus,
} from '../types/machine-runtime.types';

const MAX_UPDATE_TEXT_LENGTH = 2048;

export class MachineReleaseSummaryDto implements MachineReleaseSummary {
	@ApiProperty()
	@IsString()
	@MaxLength(MAX_UPDATE_TEXT_LENGTH)
	digest: string;

	@ApiProperty()
	@IsString()
	@MaxLength(MAX_UPDATE_TEXT_LENGTH)
	channel: string;

	@ApiProperty()
	@IsString()
	@MaxLength(MAX_UPDATE_TEXT_LENGTH)
	version: string;

	@ApiProperty({ format: 'date-time' })
	@IsDateString({ strict: true })
	installedAt: string;
}

export class MachineUpdateStatusDto implements MachineUpdateStatus {
	@ApiProperty()
	@IsString()
	@MaxLength(MAX_UPDATE_TEXT_LENGTH)
	channel: string;

	@ApiProperty()
	@IsString()
	@MaxLength(MAX_UPDATE_TEXT_LENGTH)
	maintenanceWindow: string;

	@ApiProperty({ enum: MachineUpdatePhase, enumName: 'MachineUpdatePhase' })
	@IsEnum(MachineUpdatePhase)
	phase: MachineUpdatePhase;

	@ApiPropertyOptional({ type: MachineReleaseSummaryDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => MachineReleaseSummaryDto)
	candidate?: MachineReleaseSummaryDto;

	@ApiPropertyOptional({ type: MachineReleaseSummaryDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => MachineReleaseSummaryDto)
	active?: MachineReleaseSummaryDto;

	@ApiPropertyOptional({ type: MachineReleaseSummaryDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => MachineReleaseSummaryDto)
	previous?: MachineReleaseSummaryDto;

	@ApiPropertyOptional({ maxLength: MAX_UPDATE_TEXT_LENGTH })
	@IsOptional()
	@IsString()
	@MaxLength(MAX_UPDATE_TEXT_LENGTH)
	lastFailure?: string;

	@ApiProperty({ format: 'date-time' })
	@IsDateString({ strict: true })
	updatedAt: string;
}
