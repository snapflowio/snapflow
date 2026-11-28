/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsDateString,
	IsEnum,
	IsInt,
	IsString,
	IsUUID,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import {
	ABUSE_REPORT_LIMITS,
	AbuseSignalKind,
	AbuseSignalSeverity,
} from '../constants/abuse.constants';

@ApiSchema({ name: 'MachineAbuseFinding' })
export class MachineAbuseFindingDto {
	@ApiProperty({ enum: AbuseSignalKind, enumName: 'AbuseSignalKind' })
	@IsEnum(AbuseSignalKind)
	kind: AbuseSignalKind;

	@ApiProperty({
		enum: AbuseSignalSeverity,
		enumName: 'AbuseSignalSeverity',
		description:
			'Hard signals suspend the sandbox at once; soft signals throttle it first',
	})
	@IsEnum(AbuseSignalSeverity)
	severity: AbuseSignalSeverity;

	@ApiProperty({
		type: 'integer',
		minimum: ABUSE_REPORT_LIMITS.minimumCount,
		description: 'How often the machine saw the signal since its last report',
	})
	@IsInt()
	@Min(ABUSE_REPORT_LIMITS.minimumCount)
	count: number;

	@ApiProperty({
		maxLength: ABUSE_REPORT_LIMITS.maximumDetailLength,
		description: 'What the machine saw, for the reviewer',
	})
	@IsString()
	@MaxLength(ABUSE_REPORT_LIMITS.maximumDetailLength)
	detail: string;
}

@ApiSchema({ name: 'MachineSandboxAbuse' })
export class MachineSandboxAbuseDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	sandboxId: string;

	@ApiProperty({
		type: [MachineAbuseFindingDto],
		minItems: ABUSE_REPORT_LIMITS.minimumFindings,
		maxItems: ABUSE_REPORT_LIMITS.maximumFindings,
	})
	@ArrayMinSize(ABUSE_REPORT_LIMITS.minimumFindings)
	@ArrayMaxSize(ABUSE_REPORT_LIMITS.maximumFindings)
	@ValidateNested({ each: true })
	@Type(() => MachineAbuseFindingDto)
	findings: MachineAbuseFindingDto[];
}

@ApiSchema({ name: 'MachineAbuseReport' })
export class MachineAbuseReportDto {
	@ApiProperty({
		type: String,
		format: 'date-time',
		description: 'When the machine evaluated the signals',
	})
	@IsDateString({ strict: true })
	observedAt: string;

	@ApiProperty({
		type: [MachineSandboxAbuseDto],
		maxItems: ABUSE_REPORT_LIMITS.maximumSandboxes,
	})
	@ArrayMaxSize(ABUSE_REPORT_LIMITS.maximumSandboxes)
	@ValidateNested({ each: true })
	@Type(() => MachineSandboxAbuseDto)
	sandboxes: MachineSandboxAbuseDto[];
}
