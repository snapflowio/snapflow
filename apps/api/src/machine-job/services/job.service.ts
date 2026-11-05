/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { context as otelContext, propagation } from '@opentelemetry/api';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import {
	TRACE_PARENT_HEADER,
	TRACE_STATE_HEADER,
	type TraceContext,
} from '../../common/types/trace-context.types';
import { isUniqueViolation } from '../../common/utils/error/database-error.util';
import {
	errorConstraint,
	errorMessage,
} from '../../common/utils/error/error.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { MachineJobNotificationService } from '../../machine/services/machine-job-notification.service';
import {
	JOB_COMPLETION_POLL_INTERVAL_MS,
	JOB_SUPERSEDED_MESSAGE,
} from '../constants/job-execution.constants';
import { JobDto, JobStatus, JobType } from '../dto/job.dto';
import { ResourceTypeForJobType } from '../dto/job-type-map.dto';
import { Job } from '../entities/job.entity';
import { JobProjectionStatus } from '../enums/job-projection-status.enum';
import { JobConflictException } from '../exceptions/job-conflict.exception';

const INCOMPLETE_JOB_CONSTRAINTS: ReadonlySet<string> = new Set([
	'IDX_UNIQUE_INCOMPLETE_JOB',
	'IDX_UNIQUE_INCOMPLETE_BACKUP_JOB',
]);

function encodeJobPayload(
	payload: string | object | undefined
): string | undefined {
	if (typeof payload === 'string' || payload === undefined) {
		return payload;
	}
	return JSON.stringify(payload);
}

export interface CreateJobOptions {
	assignmentGeneration?: number;
	supersedePending?: boolean;
}

@Injectable()
export class JobService {
	private readonly logger = new Logger(JobService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineNotifications: MachineJobNotificationService
	) {}

	async createJob<T extends JobType>(
		manager: EntityManager | null,
		type: T,
		machineId: string,
		resourceType: ResourceTypeForJobType<T>,
		resourceId: string,
		payload?: string | object,
		options: CreateJobOptions = {}
	): Promise<Job> {
		const job = new Job({
			type,
			machineId,
			resourceType,
			resourceId,
			assignmentGeneration: options.assignmentGeneration,
			status: JobStatus.PENDING,
			payload: encodeJobPayload(payload),
			traceContext: this.captureTraceContext(),
		});
		const insert = async (entityManager: EntityManager): Promise<void> => {
			if (options.supersedePending) {
				await this.supersedePendingJobs(entityManager, job);
			}
			entityManager.persist(job);
		};

		try {
			if (manager) {
				await insert(manager);
			} else {
				await this.entityManager.transactional(insert, {
					propagation: TransactionPropagation.REQUIRED,
				});
			}

			const contextInfo = resourceId ? `${resourceType} ${resourceId}` : 'N/A';

			this.logger.debug(
				`Created job ${job.id} of type ${type} for ${contextInfo} on machine ${machineId}`
			);

			if (!manager) {
				this.notifyCreatedJob(job);
			}

			return job;
		} catch (error: unknown) {
			throw this.creationError(error, job);
		}
	}

	private creationError(error: unknown, job: Job): unknown {
		if (!isUniqueViolation(error)) {
			this.logger.error(`Error creating job: ${errorMessage(error)}`);
			return error;
		}
		const constraint = errorConstraint(error);
		if (constraint && INCOMPLETE_JOB_CONSTRAINTS.has(constraint)) {
			this.logger.error(
				`An incomplete job already exists for ${job.resourceType} ${job.resourceId} on machine ${job.machineId}`
			);
		}
		return new JobConflictException();
	}

	private async supersedePendingJobs(
		manager: EntityManager,
		job: Job
	): Promise<void> {
		const now = await databaseNow(manager);
		const superseded = await manager.nativeUpdate(
			Job,
			{
				type: job.type,
				machineId: job.machineId,
				resourceType: job.resourceType,
				resourceId: job.resourceId,
				status: JobStatus.PENDING,
				leaseToken: null,
			},
			{
				status: JobStatus.FAILED,
				completedAt: now,
				errorMessage: `${JOB_SUPERSEDED_MESSAGE} ${job.id}`,
				projectionStatus: JobProjectionStatus.NOT_REQUIRED,
				updatedAt: now,
			}
		);
		if (superseded > 0) {
			this.logger.debug(
				`Job ${job.id} superseded ${superseded} pending ${job.type} jobs for ${job.resourceType} ${job.resourceId}`
			);
		}
	}

	notifyCreatedJob(job: Pick<Job, 'id' | 'machineId'>): void {
		this.machineNotifications.notify(job.machineId, job.id);
	}

	private captureTraceContext(): TraceContext | null {
		try {
			const carrier: Record<string, string> = {};
			propagation.inject(otelContext.active(), carrier);
			const traceparent = carrier[TRACE_PARENT_HEADER];
			if (!traceparent) {
				return null;
			}
			const tracestate = carrier[TRACE_STATE_HEADER];
			return tracestate ? { traceparent, tracestate } : { traceparent };
		} catch (error: unknown) {
			this.logger.warn(
				`Failed to capture trace context: ${errorMessage(error)}`
			);
			return null;
		}
	}

	async findOne(jobId: string): Promise<Job | null> {
		return this.entityManager.findOne(Job, { id: jobId });
	}

	async findJobsForMachine(
		machineId: string,
		status?: JobStatus,
		limit = 100,
		cursor?: string
	): Promise<CursorPage<JobDto>> {
		const whereCondition: { machineId: string; status?: JobStatus } = {
			machineId,
		};

		if (status) {
			whereCondition.status = status;
		}

		const page = await findCursorPage(this.entityManager, Job, {
			where: whereCondition,
			orderBy: { createdAt: 'DESC', id: 'DESC' },
			limit,
			cursor,
		});

		return {
			...page,
			items: page.items.map((job) => new JobDto(job)),
		};
	}

	async waitJobCompletion(
		jobId: string,
		waitTimeout: number
	): Promise<Job | null> {
		const startTime = Date.now();
		const endTime = startTime + waitTimeout;

		while (Date.now() < endTime) {
			const job = await this.entityManager.findOne(
				Job,
				{ id: jobId },
				{ refresh: true }
			);
			if (!job) {
				return null;
			}

			if (
				job.status === JobStatus.COMPLETED ||
				job.status === JobStatus.FAILED
			) {
				return job;
			}

			await new Promise((resolve) =>
				setTimeout(resolve, JOB_COMPLETION_POLL_INTERVAL_MS)
			);
		}

		throw new Error(`Job ${jobId} timed out after ${waitTimeout}ms`);
	}
}
