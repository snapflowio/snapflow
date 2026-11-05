/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { addMilliseconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { recordOperationDuration } from '../../infra/logging/utils/operation-observability.util';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { MachineSessionService } from '../../machine/services/machine-session.service';
import { MachineAssessmentService } from '../../machine/services/qualification/machine-assessment.service';
import { MachineReliabilityService } from '../../machine/services/qualification/machine-reliability.service';
import {
	JOB_LEASE_DURATION_MILLISECONDS,
	JOB_LEASE_EXPIRY_BATCH_SIZE,
	VERIFICATION_JOB_TYPES,
} from '../constants/job-execution.constants';
import { JobDto } from '../dto/job.dto';
import { Job } from '../entities/job.entity';
import { JobStatus } from '../enums/job-status.enum';
import { abandonJobLease } from '../utils/abandoned-job-lease.util';
import { assertActiveLease } from '../utils/active-job-lease.util';

export interface ExpiredLeaseResult {
	requeued: Job[];
	failed: Job[];
}

@Injectable()
export class JobLeaseService {
	private readonly logger = new Logger(JobLeaseService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessionService: MachineSessionService,
		private readonly reliability: MachineReliabilityService,
		private readonly assessments: MachineAssessmentService
	) {}

	async claimPendingJobs(
		machineId: string,
		machineSessionId: string,
		limit: number
	): Promise<JobDto[]> {
		const claimed = await this.entityManager.transactional(
			async (manager) => {
				const now = await databaseNow(manager);
				const machine = await this.machineSessionService.assertCurrent(
					manager,
					machineId,
					machineSessionId,
					now
				);
				if (machine.state !== MachineState.READY) return [];

				const handedOver = await this.handOverSessionLeases(
					manager,
					machineId,
					machineSessionId,
					limit,
					now
				);
				const remaining = limit - handedOver.length;
				const claimedPending =
					remaining > 0
						? await this.leasePendingJobs(
								manager,
								machineId,
								machineSessionId,
								remaining,
								now
							)
						: [];
				const jobs = [...handedOver, ...claimedPending];
				if (jobs.length > 0) {
					this.logger.debug(
						`Leased ${claimedPending.length} pending and handed over ${handedOver.length} in-flight jobs for machine ${machineId}`
					);
				}
				return jobs.map((job) => new JobDto(job));
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		const observedAt = Date.now();
		for (const job of claimed) {
			recordOperationDuration(
				'machine.job.claim_delay',
				Math.max(0, observedAt - Date.parse(job.createdAt)),
				{ 'job.type': job.type }
			);
		}
		return claimed;
	}

	private async handOverSessionLeases(
		manager: EntityManager,
		machineId: string,
		machineSessionId: string,
		limit: number,
		now: Date
	): Promise<Job[]> {
		const jobs = await manager
			.createQueryBuilder(Job, 'job')
			.select('*')
			.where({
				machineId,
				status: JobStatus.IN_PROGRESS,
				leasedBySessionId: { $ne: machineSessionId },
				leaseExpiresAt: { $gt: now },
			})
			.orderBy({ 'job.createdAt': 'ASC', 'job.id': 'ASC' })
			.limit(limit)
			.setLockMode(LockMode.PESSIMISTIC_PARTIAL_WRITE)
			.getResultList();
		for (const job of jobs) {
			job.leasedBySessionId = machineSessionId;
			job.leaseExpiresAt = this.leaseExpiry(now);
		}
		return jobs;
	}

	private async leasePendingJobs(
		manager: EntityManager,
		machineId: string,
		machineSessionId: string,
		limit: number,
		now: Date
	): Promise<Job[]> {
		const jobs = await manager
			.createQueryBuilder(Job, 'job')
			.select('*')
			.where({
				machineId,
				status: JobStatus.PENDING,
				availableAt: { $lte: now },
			})
			.andWhere('job.attempt < job."maxAttempts"')
			.orderBy({ 'job.createdAt': 'ASC', 'job.id': 'ASC' })
			.limit(limit)
			.setLockMode(LockMode.PESSIMISTIC_PARTIAL_WRITE)
			.getResultList();
		for (const job of jobs) {
			job.status = JobStatus.IN_PROGRESS;
			job.startedAt ??= now;
			job.attempt += 1;
			job.leaseToken = randomUUID();
			job.leaseExpiresAt = this.leaseExpiry(now);
			job.leasedBySessionId = machineSessionId;
		}
		return jobs;
	}

	async expireLeases(): Promise<ExpiredLeaseResult> {
		return this.entityManager.transactional(
			async (manager) => {
				const now = await databaseNow(manager);
				const jobs = await manager.find(
					Job,
					{
						status: JobStatus.IN_PROGRESS,
						leaseExpiresAt: { $lte: now },
					},
					{
						lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE,
						orderBy: { leaseExpiresAt: 'ASC' },
						limit: JOB_LEASE_EXPIRY_BATCH_SIZE,
					}
				);

				const result: ExpiredLeaseResult = { requeued: [], failed: [] };
				const lapsedMachines = new Set<string>();
				for (const job of jobs) {
					if (
						!VERIFICATION_JOB_TYPES.has(job.type) &&
						(await this.reliability.recordLeaseExpiry(manager, job, now))
					) {
						lapsedMachines.add(job.machineId);
					}
					const transition = abandonJobLease(
						job,
						now,
						`Job lease expired after ${job.attempt} attempts`
					);
					if (transition === 'requeued') {
						result.requeued.push(job);
					} else {
						result.failed.push(job);
					}
				}
				await manager.flush();
				for (const machineId of lapsedMachines) {
					await this.assessments.assess(manager, machineId);
				}
				return result;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async renewLease(
		machineId: string,
		machineSessionId: string,
		jobId: string,
		leaseToken: string,
		attempt: number
	): Promise<JobDto> {
		const job = await this.entityManager.transactional(
			async (manager) => {
				const now = await databaseNow(manager);
				await this.machineSessionService.assertCurrent(
					manager,
					machineId,
					machineSessionId,
					now
				);
				const lockedJob = await manager.findOne(
					Job,
					{ id: jobId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!lockedJob) throw new NotFoundException(`Job ${jobId} not found`);
				assertActiveLease(lockedJob, machineId, leaseToken, attempt, now);

				lockedJob.leasedBySessionId = machineSessionId;
				lockedJob.leaseExpiresAt = this.leaseExpiry(now);
				return lockedJob;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		return new JobDto(job);
	}

	private leaseExpiry(now: Date): Date {
		return addMilliseconds(now, JOB_LEASE_DURATION_MILLISECONDS);
	}
}
