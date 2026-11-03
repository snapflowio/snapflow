/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { truncateErrorMessage } from '../../../common/utils/error/truncate-error-message.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { MachineSessionService } from '../../machine/services/machine-session.service';
import { MachineAssessmentService } from '../../machine/services/qualification/machine-assessment.service';
import { MachineQualificationAppraisalService } from '../../machine/services/qualification/machine-qualification-appraisal.service';
import { MachineReliabilityService } from '../../machine/services/qualification/machine-reliability.service';
import { VERIFICATION_JOB_TYPES } from '../constants/job-execution.constants';
import type { JobExecutionResultDto } from '../dto/job-execution-result.dto';
import { Job } from '../entities/job.entity';
import { JobProjectionStatus } from '../enums/job-projection-status.enum';
import { JobStatus } from '../enums/job-status.enum';
import { JobType } from '../enums/job-type.enum';
import { assertActiveLease } from '../utils/active-job-lease.util';
import { JobProjectionService } from './job-projection.service';

const RESULT_DIGEST_ALGORITHM = 'sha256';

export interface CompleteJobInput {
	jobId: string;
	machineId: string;
	machineSessionId: string;
	status: JobStatus;
	leaseToken: string;
	attempt: number;
	errorMessage?: string;
	resultMetadata?: string;
	executionResult: JobExecutionResultDto;
}

@Injectable()
export class JobCompletionService {
	private readonly logger = new Logger(JobCompletionService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(JobProjectionService)
		private readonly jobProjectionService: Pick<
			JobProjectionService,
			'tryProject'
		>,
		private readonly machineSessionService: MachineSessionService,
		private readonly machineReliabilityService: MachineReliabilityService,
		private readonly machineAssessmentService: MachineAssessmentService,
		private readonly machineQualificationAppraisalService: MachineQualificationAppraisalService
	) {}

	async complete(input: CompleteJobInput): Promise<Job> {
		const job = await this.entityManager.transactional(
			async (manager) => {
				const now = await databaseNow(manager);
				await this.machineSessionService.assertCurrent(
					manager,
					input.machineId,
					input.machineSessionId,
					now
				);
				const current = await this.lockOwnedJob(manager, input);
				if (isAcceptedReplay(current, input)) {
					return current;
				}
				assertActiveLease(
					current,
					input.machineId,
					input.leaseToken,
					input.attempt,
					now
				);
				acceptJobResult(current, input, now);
				await this.recordEvidence(manager, current, input, now);
				return current;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);

		await this.jobProjectionService.tryProject(job.id);
		this.logger.debug(
			`Accepted ${input.status} result for job ${job.id} attempt ${input.attempt}`
		);
		return (
			(await this.entityManager.findOne(
				Job,
				{ id: job.id },
				{ refresh: true }
			)) ?? job
		);
	}

	private async lockOwnedJob(
		manager: EntityManager,
		input: CompleteJobInput
	): Promise<Job> {
		const current = await manager.findOne(
			Job,
			{ id: input.jobId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!current) {
			throw new NotFoundException(`Job with ID ${input.jobId} not found`);
		}
		if (current.machineId !== input.machineId) {
			throw new ForbiddenException('Machine does not own this job');
		}
		return current;
	}

	private async recordEvidence(
		manager: EntityManager,
		job: Job,
		input: CompleteJobInput,
		now: Date
	): Promise<void> {
		await this.machineQualificationAppraisalService.appraise(
			manager,
			job,
			input.resultMetadata,
			now
		);
		if (!(await this.evidenceChanged(manager, job, input, now))) {
			return;
		}
		await manager.flush();
		await this.machineAssessmentService.assess(manager, job.machineId);
	}

	private async evidenceChanged(
		manager: EntityManager,
		job: Job,
		input: CompleteJobInput,
		now: Date
	): Promise<boolean> {
		if (job.type === JobType.QUALIFY_MACHINE) {
			return true;
		}
		if (VERIFICATION_JOB_TYPES.has(job.type)) {
			return false;
		}
		return this.machineReliabilityService.recordJobCompletion(
			manager,
			job,
			input.executionResult,
			now
		);
	}
}

function isTerminal(status: JobStatus): boolean {
	return status === JobStatus.COMPLETED || status === JobStatus.FAILED;
}

function isAcceptedReplay(current: Job, input: CompleteJobInput): boolean {
	if (isTerminal(current.status)) {
		if (
			current.status === input.status &&
			current.acceptedLeaseToken === input.leaseToken &&
			current.acceptedAttempt === input.attempt
		) {
			return true;
		}
		throw new ConflictException('Job already has an accepted result');
	}
	if (!isTerminal(input.status)) {
		throw new ConflictException(
			'Machine status updates must contain a terminal status'
		);
	}
	return false;
}

function acceptJobResult(job: Job, input: CompleteJobInput, now: Date): void {
	job.status = input.status;
	job.completedAt = now;
	job.errorMessage = input.errorMessage
		? truncateErrorMessage(input.errorMessage)
		: null;
	job.resultMetadata = input.resultMetadata ?? null;
	job.executionResult = input.executionResult;
	job.resultDigest = createHash(RESULT_DIGEST_ALGORITHM)
		.update(input.resultMetadata ?? '')
		.digest('hex');
	job.acceptedAttempt = input.attempt;
	job.acceptedLeaseToken = input.leaseToken;
	job.acceptedSessionId = input.machineSessionId;
	job.leaseToken = null;
	job.leaseExpiresAt = null;
	job.leasedBySessionId = null;
	job.projectionStatus = JobProjectionStatus.PENDING;
	job.projectionError = null;
}
