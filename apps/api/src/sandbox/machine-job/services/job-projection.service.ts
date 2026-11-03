/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { errorMessage } from '../../../common/utils/error/error.util';
import {
	addMilliseconds,
	millisecondsBetween,
} from '../../../common/utils/time.util';
import {
	observeOperation,
	recordOperationDuration,
} from '../../../infra/logging/utils/operation-observability.util';
import {
	JOB_PROJECTION_BATCH_SIZE,
	JOB_PROJECTION_STALE_AFTER_MINUTES,
} from '../constants/job-execution.constants';
import { Job } from '../entities/job.entity';
import { JobProjectionStatus } from '../enums/job-projection-status.enum';
import { projectionFailureOutcome } from '../utils/job-projection-retry.util';
import { JobStateHandlerService } from './job-state-handler.service';

@Injectable()
export class JobProjectionService {
	private readonly logger = new Logger(JobProjectionService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly jobStateHandler: JobStateHandlerService
	) {}

	async tryProject(jobId: string): Promise<boolean> {
		const claimedAt = new Date();
		const claim = await this.entityManager.nativeUpdate(
			Job,
			{
				id: jobId,
				projectionStatus: JobProjectionStatus.PENDING,
				$or: [
					{ projectionRetryAt: null },
					{ projectionRetryAt: { $lte: claimedAt } },
				],
			},
			{
				projectionStatus: JobProjectionStatus.PROCESSING,
				projectionClaimedAt: claimedAt,
				updatedAt: claimedAt,
			}
		);
		if (claim !== 1) return false;

		const job = await this.entityManager.findOne(
			Job,
			{ id: jobId },
			{ refresh: true }
		);
		if (!job) {
			this.logger.error(`Claimed projection job ${jobId} no longer exists`);
			return false;
		}

		try {
			await observeOperation(
				'sandbox.projection.complete',
				{ 'job.type': job.type },
				() => this.jobStateHandler.handleJobCompletion(job)
			);
		} catch (error) {
			await this.recordFailure(job, errorMessage(error));
			return false;
		}

		const projectedAt = new Date();
		await this.entityManager.nativeUpdate(
			Job,
			{ id: jobId, projectionStatus: JobProjectionStatus.PROCESSING },
			{
				projectionStatus: JobProjectionStatus.APPLIED,
				projectedAt,
				projectionClaimedAt: null,
				projectionRetryAt: null,
				projectionAttempts: job.projectionAttempts + 1,
				projectionError: null,
				updatedAt: projectedAt,
			}
		);
		this.recordProjectionDurations(job, projectedAt);
		return true;
	}

	private async recordFailure(job: Job, message: string): Promise<void> {
		const failedAt = new Date();
		const attempts = job.projectionAttempts + 1;
		const outcome = projectionFailureOutcome(attempts, failedAt);
		await this.entityManager.nativeUpdate(
			Job,
			{ id: job.id, projectionStatus: JobProjectionStatus.PROCESSING },
			{
				projectionStatus: outcome.status,
				projectionClaimedAt: null,
				projectionRetryAt: outcome.retryAt,
				projectionAttempts: attempts,
				projectionError: message,
				updatedAt: failedAt,
			}
		);
		if (outcome.status === JobProjectionStatus.FAILED) {
			this.logger.error(
				`Giving up projecting ${job.type} job ${job.id} for ${job.resourceType} ${job.resourceId} after ${attempts} attempts: ${message}`
			);
			return;
		}
		this.logger.warn(
			`Failed to project ${job.type} job ${job.id} (attempt ${attempts}), retrying after ${outcome.retryAt.toISOString()}: ${message}`
		);
	}

	private recordProjectionDurations(job: Job, projectedAt: Date): void {
		if (job.completedAt) {
			recordOperationDuration(
				'sandbox.projection.delay',
				Math.max(0, millisecondsBetween(job.completedAt, projectedAt)),
				{ 'job.type': job.type }
			);
		}
	}

	async reconcilePendingProjections(): Promise<void> {
		await RequestContext.create(this.entityManager, () =>
			this.reconcilePendingProjectionsInContext()
		);
	}

	private async reconcilePendingProjectionsInContext(): Promise<void> {
		const now = new Date();
		const staleBefore = addMilliseconds(
			now,
			-JOB_PROJECTION_STALE_AFTER_MINUTES * MILLISECONDS_PER_MINUTE
		);
		await this.entityManager.nativeUpdate(
			Job,
			{
				projectionStatus: JobProjectionStatus.PROCESSING,
				projectionClaimedAt: { $lt: staleBefore },
			},
			{
				projectionStatus: JobProjectionStatus.PENDING,
				projectionClaimedAt: null,
				updatedAt: now,
			}
		);

		const jobs = await this.entityManager.find(
			Job,
			{
				projectionStatus: JobProjectionStatus.PENDING,
				$or: [
					{ projectionRetryAt: null },
					{ projectionRetryAt: { $lte: now } },
				],
			},
			{
				fields: ['id'],
				orderBy: { completedAt: 'ASC' },
				limit: JOB_PROJECTION_BATCH_SIZE,
			}
		);
		for (const job of jobs) {
			await this.tryProject(job.id);
		}
	}
}
