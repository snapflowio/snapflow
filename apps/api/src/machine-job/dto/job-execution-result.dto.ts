/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Equals,
	IsBoolean,
	IsEnum,
	IsIn,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	MaxLength,
} from 'class-validator';
import {
	JOB_EXECUTION_OUTCOME,
	JOB_EXECUTION_RESULT_SCHEMA_VERSION,
	JOB_LIFECYCLE_PHASE,
	type JobExecutionOutcome,
	type JobLifecyclePhase,
	MACHINE_RELIABILITY_LIMITS,
} from '../../machine/constants/machine-reliability.constants';
import { JobErrorCode } from '../enums/job-error-code.enum';
import type { JobExecutionResult } from '../types/job-execution-result.types';

export class JobExecutionResultDto implements JobExecutionResult {
	@ApiProperty({ type: Number, example: JOB_EXECUTION_RESULT_SCHEMA_VERSION })
	@IsInt()
	@Equals(JOB_EXECUTION_RESULT_SCHEMA_VERSION)
	schemaVersion: number;

	@ApiProperty({ enum: Object.values(JOB_EXECUTION_OUTCOME) })
	@IsIn(Object.values(JOB_EXECUTION_OUTCOME))
	outcome: JobExecutionOutcome;

	@ApiProperty({ enum: Object.values(JOB_LIFECYCLE_PHASE) })
	@IsIn(Object.values(JOB_LIFECYCLE_PHASE))
	phase: JobLifecyclePhase;

	@ApiProperty({ enum: JobErrorCode, enumName: 'JobErrorCode' })
	@IsEnum(JobErrorCode)
	errorCode: JobErrorCode;

	@ApiProperty()
	@IsBoolean()
	retryable: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(MACHINE_RELIABILITY_LIMITS.DIAGNOSTIC)
	diagnostic?: string;

	@ApiProperty()
	@IsString()
	@MaxLength(MACHINE_RELIABILITY_LIMITS.IDENTITY)
	runtimeIdentity: string;

	@ApiProperty()
	@IsString()
	@MaxLength(MACHINE_RELIABILITY_LIMITS.IDENTITY)
	releaseIdentity: string;

	@ApiPropertyOptional({ type: 'object', additionalProperties: true })
	@IsOptional()
	@IsObject()
	timingsMs?: Record<string, number>;

	@ApiPropertyOptional({ type: 'object', additionalProperties: true })
	@IsOptional()
	@IsObject()
	evidence?: Record<string, string | number | boolean>;
}
