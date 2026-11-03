/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Check,
	Entity,
	Enum,
	Index,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { v4 } from 'uuid';
import type { TraceContext } from '../../../common/types/trace-context.types';
import { JOB_DEFAULT_MAX_ATTEMPTS } from '../constants/job-execution.constants';
import { JobProjectionStatus } from '../enums/job-projection-status.enum';
import { JobStatus } from '../enums/job-status.enum';
import { BACKUP_JOB_TYPES, JobType } from '../enums/job-type.enum';
import { ResourceType } from '../enums/resource-type.enum';
import type { JobExecutionResult } from '../types/job-execution-result.types';

const BACKUP_JOB_TYPE_LIST = BACKUP_JOB_TYPES.map((type) => `'${type}'`).join(
	', '
);

@Entity({ tableName: 'job' })
@Index({
	properties: ['machineId', 'status'],
})
@Index({
	name: 'IDX_job_machine_status_created',
	properties: ['machineId', 'status', 'createdAt', 'id'],
})
@Index({
	name: 'IDX_job_machine_status_available',
	properties: ['machineId', 'status', 'availableAt'],
})
@Index({
	name: 'IDX_job_status_lease_expiry',
	properties: ['status', 'leaseExpiresAt'],
})
@Index({
	name: 'IDX_job_projection_status_completed',
	properties: ['projectionStatus', 'completedAt'],
})
@Index({
	properties: ['status', 'createdAt'],
})
@Index({
	properties: ['resourceType', 'resourceId'],
})
@Unique({
	name: 'IDX_UNIQUE_INCOMPLETE_JOB',
	properties: ['resourceType', 'resourceId', 'machineId'],
	where: `"completedAt" is null and "type" not in (${BACKUP_JOB_TYPE_LIST})`,
})
@Unique({
	name: 'IDX_UNIQUE_INCOMPLETE_BACKUP_JOB',
	properties: ['resourceType', 'resourceId', 'machineId'],
	where: `"completedAt" is null and "type" in (${BACKUP_JOB_TYPE_LIST})`,
})
@Check({
	name: 'CHK_job_attempt_bounds',
	expression: 'attempt >= 0 and "maxAttempts" > 0 and attempt <= "maxAttempts"',
})
@Check({
	name: 'CHK_job_active_lease',
	expression: `status <> '${JobStatus.IN_PROGRESS}' or ("leaseToken" is not null and "leaseExpiresAt" is not null and "leasedBySessionId" is not null and attempt > 0)`,
})
@Check({
	name: 'CHK_job_assignment_generation',
	expression: '"assignmentGeneration" is null or "assignmentGeneration" > 0',
})
export class Job {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		version: true,
	})
	version: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	type: JobType;

	@Enum({
		items: () => JobStatus,
		nativeEnumName: 'job_status_enum',
		default: JobStatus.PENDING,
	})
	status: JobStatus;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'machineId',
	})
	machineId: string;

	@Enum({
		items: () => ResourceType,
		nativeEnumName: 'job_resourcetype_enum',
		fieldName: 'resourceType',
	})
	resourceType: ResourceType;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'resourceId',
	})
	resourceId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
		nullable: true,
	})
	assignmentGeneration: number | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		nullable: true,
	})
	payload: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'resultMetadata',
		nullable: true,
	})
	resultMetadata: string | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'executionResult',
		nullable: true,
	})
	executionResult: JobExecutionResult | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'availableAt',
		defaultRaw: 'CURRENT_TIMESTAMP',
	})
	availableAt: Date;

	@Property({
		type: 'integer',
		columnType: 'integer',
		default: 0,
	})
	attempt: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'maxAttempts',
		default: JOB_DEFAULT_MAX_ATTEMPTS,
	})
	maxAttempts: number;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'leaseToken',
		nullable: true,
	})
	leaseToken: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'leaseExpiresAt',
		nullable: true,
	})
	leaseExpiresAt: Date | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'leasedBySessionId',
		nullable: true,
	})
	leasedBySessionId: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'acceptedAttempt',
		nullable: true,
	})
	acceptedAttempt: number | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'acceptedLeaseToken',
		nullable: true,
	})
	acceptedLeaseToken: string | null;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'acceptedSessionId',
		nullable: true,
	})
	acceptedSessionId: string | null;

	@Property({
		type: 'string',
		columnType: 'varchar(64)',
		fieldName: 'resultDigest',
		nullable: true,
	})
	resultDigest: string | null;

	@Enum({
		items: () => JobProjectionStatus,
		nativeEnumName: 'job_projection_status_enum',
		fieldName: 'projectionStatus',
		default: JobProjectionStatus.NOT_REQUIRED,
	})
	projectionStatus: JobProjectionStatus;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'projectedAt',
		nullable: true,
	})
	projectedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'projectionClaimedAt',
		nullable: true,
	})
	projectionClaimedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'projectionRetryAt',
		nullable: true,
	})
	projectionRetryAt: Date | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'projectionAttempts',
		default: 0,
	})
	projectionAttempts: number;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'projectionError',
		nullable: true,
	})
	projectionError: string | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'traceContext',
		nullable: true,
	})
	traceContext: TraceContext | null;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'errorMessage',
		nullable: true,
	})
	errorMessage: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'startedAt',
		nullable: true,
	})
	startedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'completedAt',
		nullable: true,
	})
	completedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;

	constructor(params?: {
		id?: string;
		type: JobType;
		status?: JobStatus;
		machineId: string;
		resourceType: ResourceType;
		resourceId: string;
		assignmentGeneration?: number | null;
		payload?: string | null;
		traceContext?: TraceContext | null;
		errorMessage?: string | null;
		startedAt?: Date | null;
		completedAt?: Date | null;
		maxAttempts?: number;
	}) {
		if (!params) return;
		this.id = params.id || v4();
		this.version = 1;
		this.type = params.type;
		this.status = params.status || JobStatus.PENDING;
		this.machineId = params.machineId;
		this.resourceType = params.resourceType;
		this.resourceId = params.resourceId;
		this.assignmentGeneration = params.assignmentGeneration ?? null;
		this.payload = params.payload || null;
		this.resultMetadata = null;
		this.executionResult = null;
		this.availableAt = new Date();
		this.attempt = 0;
		this.maxAttempts = params.maxAttempts ?? JOB_DEFAULT_MAX_ATTEMPTS;
		this.leaseToken = null;
		this.leaseExpiresAt = null;
		this.leasedBySessionId = null;
		this.acceptedAttempt = null;
		this.acceptedLeaseToken = null;
		this.acceptedSessionId = null;
		this.resultDigest = null;
		this.projectionStatus = JobProjectionStatus.NOT_REQUIRED;
		this.projectedAt = null;
		this.projectionClaimedAt = null;
		this.projectionRetryAt = null;
		this.projectionAttempts = 0;
		this.projectionError = null;
		this.traceContext = params.traceContext ?? null;
		this.errorMessage = params.errorMessage || null;
		this.startedAt = params.startedAt || null;
		this.completedAt = params.completedAt || null;
		this.createdAt = new Date();
		this.updatedAt = new Date();
	}

	getPayload<T = Record<string, unknown>>(): T | null {
		if (!this.payload) {
			return null;
		}

		try {
			return JSON.parse(this.payload) as T;
		} catch {
			return null;
		}
	}

	getResultMetadata(): Record<string, unknown> | null {
		if (!this.resultMetadata) {
			return null;
		}

		try {
			return JSON.parse(this.resultMetadata) as Record<string, unknown>;
		} catch {
			return null;
		}
	}
}
