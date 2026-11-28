/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsEnum,
	IsInt,
	IsJSON,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import type { TraceContext } from '../../common/types/trace-context.types';
import { CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS } from '../../infra/control-wake/constants/control-wake.constants';
import {
	JOB_POLL_DEFAULT_LIMIT,
	JOB_POLL_MAX_LIMIT,
} from '../constants/job-execution.constants';
import { Job } from '../entities/job.entity';
import { JobStatus } from '../enums/job-status.enum';
import { JobType } from '../enums/job-type.enum';
import { ResourceType } from '../enums/resource-type.enum';
import { JobExecutionResultDto } from './job-execution-result.dto';

export { JobStatus, JobType, ResourceType };

@ApiSchema({ name: 'Job' })
export class JobDto {
	@ApiProperty({
		description: 'The ID of the job',
		example: 'job123',
	})
	id: string;

	@ApiProperty({
		description: 'The type of the job',
		enum: JobType,
		enumName: 'JobType',
		example: JobType.CREATE_BACKUP,
	})
	@IsEnum(JobType)
	type: JobType;

	@ApiProperty({
		description: 'The status of the job',
		enum: JobStatus,
		enumName: 'JobStatus',
		example: JobStatus.PENDING,
	})
	@IsEnum(JobStatus)
	status: JobStatus;

	@ApiProperty({
		description: 'The type of resource this job operates on',
		enum: ResourceType,
		example: ResourceType.SANDBOX,
	})
	@IsEnum(ResourceType)
	resourceType: ResourceType;

	@ApiProperty({
		description:
			'The ID of the resource this job operates on (sandboxId, snapshotRef, etc.)',
		example: 'sandbox123',
	})
	@IsString()
	resourceId: string;

	@ApiPropertyOptional({
		description:
			'Job-specific JSON-encoded payload data (operational metadata)',
	})
	@IsOptional()
	payload?: string;

	@ApiPropertyOptional({
		description:
			'OpenTelemetry trace context for distributed tracing (W3C Trace Context format)',
		type: 'object',
		additionalProperties: { type: 'string' },
		example: {
			traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
		},
	})
	@IsOptional()
	@IsObject()
	traceContext?: TraceContext;

	@ApiPropertyOptional({
		description: 'Error message if the job failed',
		example: 'Failed to create sandbox',
	})
	@IsOptional()
	@IsString()
	errorMessage?: string;

	@ApiProperty({
		description: 'Current one-based execution attempt',
		type: 'integer',
		format: 'int32',
	})
	attempt: number;

	@ApiProperty({
		description: 'Maximum permitted execution attempts',
		type: 'integer',
		format: 'int32',
	})
	maxAttempts: number;

	@ApiPropertyOptional({
		description: 'Opaque token proving ownership of the current job lease',
		format: 'uuid',
	})
	leaseToken?: string;

	@ApiPropertyOptional({
		description: 'Expiration time of the current job lease',
		format: 'date-time',
	})
	leaseExpiresAt?: string;

	@ApiProperty({
		description: 'The creation timestamp of the job',
		example: '2024-10-01T12:00:00Z',
	})
	createdAt: string;

	@ApiPropertyOptional({
		description: 'The last update timestamp of the job',
		example: '2024-10-01T12:00:00Z',
	})
	@IsOptional()
	updatedAt?: string;

	constructor(job: Job) {
		this.id = job.id;
		this.type = job.type;
		this.status = job.status;
		this.resourceType = job.resourceType;
		this.resourceId = job.resourceId;
		this.payload = job.payload || undefined;
		this.traceContext = job.traceContext ?? undefined;
		this.errorMessage = job.errorMessage || undefined;
		this.attempt = job.attempt;
		this.maxAttempts = job.maxAttempts;
		this.leaseToken = job.leaseToken ?? undefined;
		this.leaseExpiresAt = job.leaseExpiresAt?.toISOString();
		this.createdAt = job.createdAt.toISOString();
		this.updatedAt = job.updatedAt?.toISOString();
	}
}

@ApiSchema({ name: 'PollJobsRequest' })
export class PollJobsRequestDto {
	@ApiPropertyOptional({
		description: 'Timeout in seconds for long polling',
		example: CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS,
		maximum: CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS,
	})
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS)
	timeout = CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS;

	@ApiPropertyOptional({
		description: 'Maximum number of jobs to return',
		example: 10,
	})
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(JOB_POLL_MAX_LIMIT)
	limit = JOB_POLL_DEFAULT_LIMIT;
}

@ApiSchema({ name: 'PollJobsResponse' })
export class PollJobsResponseDto {
	@ApiProperty({
		description: 'List of jobs',
		type: [JobDto],
	})
	jobs: JobDto[];
}

@ApiSchema({ name: 'JobPage' })
export class JobPageDto extends CursorPageDto<JobDto> {
	@ApiProperty({ type: [JobDto] })
	declare items: JobDto[];
}

@ApiSchema({ name: 'ListJobsQuery' })
export class ListJobsQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({
		description: 'Filter by job status',
		enum: JobStatus,
		enumName: 'JobStatus',
		example: JobStatus.PENDING,
	})
	@IsOptional()
	@IsEnum(JobStatus)
	status?: JobStatus;
}

@ApiSchema({ name: 'UpdateJobStatus' })
export class UpdateJobStatusDto {
	@ApiProperty({
		description: 'The new status of the job',
		enum: JobStatus,
		enumName: 'JobStatus',
		example: JobStatus.IN_PROGRESS,
	})
	@IsEnum(JobStatus)
	status: JobStatus;

	@ApiProperty({
		description: 'Opaque lease token returned with the claimed job',
		format: 'uuid',
	})
	@IsUUID()
	leaseToken: string;

	@ApiProperty({
		description: 'Execution attempt returned with the claimed job',
		type: 'integer',
		format: 'int32',
		minimum: 1,
	})
	@IsInt()
	@Min(1)
	attempt: number;

	@ApiPropertyOptional({
		description: 'Error message if the job failed',
		example: 'Failed to create sandbox',
	})
	@IsOptional()
	@IsString()
	errorMessage?: string;

	@ApiPropertyOptional({
		description: 'Result metadata for the job',
	})
	@IsOptional()
	@IsJSON()
	@IsString()
	resultMetadata?: string;

	@ApiProperty({ type: JobExecutionResultDto })
	@ValidateNested()
	@Type(() => JobExecutionResultDto)
	executionResult: JobExecutionResultDto;
}

@ApiSchema({ name: 'RenewJobLease' })
export class RenewJobLeaseDto {
	@ApiProperty({
		description: 'Opaque lease token returned with the claimed job',
		format: 'uuid',
	})
	@IsUUID()
	leaseToken: string;

	@ApiProperty({
		description: 'Execution attempt returned with the claimed job',
		type: 'integer',
		format: 'int32',
		minimum: 1,
	})
	@IsInt()
	@Min(1)
	attempt: number;
}
