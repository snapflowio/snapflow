/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { fakeInstance } from '../../common/testing/instance.fake';
import {
	JOB_EXECUTION_OUTCOME,
	JOB_EXECUTION_RESULT_SCHEMA_VERSION,
	JOB_LIFECYCLE_PHASE,
} from '../../machine/constants/machine-reliability.constants';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { MachineSessionService } from '../../machine/services/machine-session.service';
import { MachineAssessmentService } from '../../machine/services/qualification/machine-assessment.service';
import { MachineQualificationAppraisalService } from '../../machine/services/qualification/machine-qualification-appraisal.service';
import { MachineReliabilityService } from '../../machine/services/qualification/machine-reliability.service';
import type { JobExecutionResultDto } from '../dto/job-execution-result.dto';
import { Job } from '../entities/job.entity';
import { JobErrorCode } from '../enums/job-error-code.enum';
import { JobStatus } from '../enums/job-status.enum';
import { JobType } from '../enums/job-type.enum';
import { ResourceType } from '../enums/resource-type.enum';
import { JobCompletionService } from './job-completion.service';
import { JobLeaseService } from './job-lease.service';

const MACHINE_ID = 'machine-1';
const OTHER_MACHINE_ID = 'machine-2';
const PREVIOUS_SESSION_ID = 'session-previous';
const CURRENT_SESSION_ID = 'session-current';
const LEASE_TOKEN = 'lease-token';
const ATTEMPT = 1;
const NOW = new Date('2026-10-04T12:00:00.000Z');
const LEASE_EXPIRES_AT = new Date('2026-10-04T12:30:00.000Z');

const SUCCEEDED: JobExecutionResultDto = {
	schemaVersion: JOB_EXECUTION_RESULT_SCHEMA_VERSION,
	outcome: JOB_EXECUTION_OUTCOME.SUCCEEDED,
	phase: JOB_LIFECYCLE_PHASE.IMAGE,
	errorCode: JobErrorCode.NONE,
	retryable: false,
	runtimeIdentity: 'runtime',
	releaseIdentity: 'release',
};

function inFlightJob(overrides: Partial<Job> = {}): Job {
	return Object.assign(
		new Job({
			type: JobType.PUBLISH_SNAPSHOT,
			machineId: MACHINE_ID,
			resourceType: ResourceType.SNAPSHOT,
			resourceId: 'snapshot-ref',
		}),
		{
			status: JobStatus.IN_PROGRESS,
			attempt: ATTEMPT,
			leaseToken: LEASE_TOKEN,
			leaseExpiresAt: LEASE_EXPIRES_AT,
			leasedBySessionId: PREVIOUS_SESSION_ID,
			...overrides,
		}
	);
}

function transactionFor(job: Job) {
	const transaction = fakeInstance(EntityManager);
	mock.method(transaction, 'execute', async () => [{ now: NOW }]);
	mock.method(transaction, 'findOne', async () => job);
	mock.method(transaction, 'flush', async () => undefined);
	const entityManager = fakeInstance(EntityManager);
	mock.method(
		entityManager,
		'transactional',
		async (work: (manager: EntityManager) => Promise<unknown>) =>
			work(transaction)
	);
	mock.method(entityManager, 'findOne', async () => job);
	const sessions = fakeInstance(MachineSessionService);
	mock.method(sessions, 'assertCurrent', async () =>
		Object.assign(new Machine(), { id: MACHINE_ID, state: MachineState.READY })
	);
	return { entityManager, transaction, sessions };
}

function completionFor(job: Job) {
	const { entityManager, sessions } = transactionFor(job);
	const qualification = fakeInstance(MachineQualificationAppraisalService);
	mock.method(qualification, 'appraise', async () => undefined);
	const reliability = fakeInstance(MachineReliabilityService);
	mock.method(reliability, 'recordJobCompletion', async () => true);
	const capacity = fakeInstance(MachineAssessmentService);
	mock.method(capacity, 'assess', async () => undefined);
	return new JobCompletionService(
		entityManager,
		{ tryProject: async () => true },
		sessions,
		reliability,
		capacity,
		qualification
	);
}

function leaseServiceFor(
	entityManager: EntityManager,
	sessions: MachineSessionService
): JobLeaseService {
	const reliability = fakeInstance(MachineReliabilityService);
	mock.method(reliability, 'recordLeaseExpiry', async () => false);
	const assessments = fakeInstance(MachineAssessmentService);
	mock.method(assessments, 'assess', async () => undefined);
	return new JobLeaseService(entityManager, sessions, reliability, assessments);
}

function complete(
	service: JobCompletionService,
	overrides: { machineId?: string; attempt?: number; sessionId?: string } = {}
) {
	return service.complete({
		jobId: 'job-1',
		machineId: overrides.machineId ?? MACHINE_ID,
		machineSessionId: overrides.sessionId ?? CURRENT_SESSION_ID,
		status: JobStatus.COMPLETED,
		leaseToken: LEASE_TOKEN,
		attempt: overrides.attempt ?? ATTEMPT,
		executionResult: SUCCEEDED,
	});
}

describe('job results across a Machine session rotation', () => {
	it('accepts the result of a lease the previous session acquired', async () => {
		const job = inFlightJob();

		const completed = await complete(completionFor(job));

		assert.equal(completed.status, JobStatus.COMPLETED);
		assert.equal(completed.acceptedAttempt, ATTEMPT);
		assert.equal(completed.acceptedSessionId, CURRENT_SESSION_ID);
		assert.equal(completed.leaseToken, null);
	});

	it('accepts a repeated result idempotently from any session of the Machine', async () => {
		const job = inFlightJob();
		const service = completionFor(job);
		await complete(service);

		const repeated = await complete(service, { sessionId: 'session-later' });

		assert.equal(repeated.status, JobStatus.COMPLETED);
		assert.equal(repeated.acceptedSessionId, CURRENT_SESSION_ID);
	});

	it('refuses a result once the job was reassigned to another Machine', async () => {
		const job = inFlightJob({ machineId: OTHER_MACHINE_ID });

		await assert.rejects(complete(completionFor(job)), ForbiddenException);
	});

	it('refuses a result for an attempt the lease no longer covers', async () => {
		const job = inFlightJob({ attempt: ATTEMPT + 1 });

		await assert.rejects(complete(completionFor(job)), ConflictException);
	});

	it('refuses a result once the lease expired', async () => {
		const job = inFlightJob({ leaseExpiresAt: NOW });

		await assert.rejects(complete(completionFor(job)), ConflictException);
	});
});

describe('job leases across a Machine session rotation', () => {
	it('lets the current session renew a lease without spending an attempt', async () => {
		const job = inFlightJob();
		const { entityManager, sessions } = transactionFor(job);
		const leases = leaseServiceFor(entityManager, sessions);

		const renewed = await leases.renewLease(
			MACHINE_ID,
			CURRENT_SESSION_ID,
			job.id,
			LEASE_TOKEN,
			ATTEMPT
		);

		assert.equal(renewed.attempt, ATTEMPT);
		assert.equal(job.leasedBySessionId, CURRENT_SESSION_ID);
		assert.ok(job.leaseExpiresAt && job.leaseExpiresAt > NOW);
	});

	it('hands in-flight jobs to the new session before leasing pending ones', async () => {
		const inFlight = inFlightJob();
		const pending = Object.assign(
			new Job({
				type: JobType.INSPECT_SNAPSHOT_IN_REGISTRY,
				machineId: MACHINE_ID,
				resourceType: ResourceType.SNAPSHOT,
				resourceId: 'other-ref',
			}),
			{ createdAt: NOW }
		);
		inFlight.createdAt = NOW;
		const results = [[inFlight], [pending]];
		const builder = {
			select: () => builder,
			where: () => builder,
			andWhere: () => builder,
			orderBy: () => builder,
			limit: () => builder,
			setLockMode: () => builder,
			getResultList: async () => results.shift() ?? [],
		};
		const { entityManager, transaction, sessions } = transactionFor(inFlight);
		mock.method(transaction, 'createQueryBuilder', () => builder);
		const leases = leaseServiceFor(entityManager, sessions);

		const claimed = await leases.claimPendingJobs(
			MACHINE_ID,
			CURRENT_SESSION_ID,
			2
		);

		assert.deepEqual(
			claimed.map(({ id }) => id),
			[inFlight.id, pending.id]
		);
		assert.equal(inFlight.attempt, ATTEMPT);
		assert.equal(inFlight.leaseToken, LEASE_TOKEN);
		assert.equal(inFlight.leasedBySessionId, CURRENT_SESSION_ID);
		assert.equal(pending.attempt, 1);
		assert.equal(pending.status, JobStatus.IN_PROGRESS);
	});
});

describe('verification jobs and Machine reliability', () => {
	it('keeps a failed machine benchmark out of the reliability evidence', async () => {
		const job = inFlightJob({
			type: JobType.BENCHMARK_MACHINE,
			resourceType: ResourceType.MACHINE,
			resourceId: MACHINE_ID,
		});
		const { entityManager, sessions } = transactionFor(job);
		const qualification = fakeInstance(MachineQualificationAppraisalService);
		mock.method(qualification, 'appraise', async () => undefined);
		const reliability = fakeInstance(MachineReliabilityService);
		const recorded = mock.method(
			reliability,
			'recordJobCompletion',
			async () => true
		);
		const assessments = fakeInstance(MachineAssessmentService);
		const assessed = mock.method(assessments, 'assess', async () => undefined);
		const service = new JobCompletionService(
			entityManager,
			{ tryProject: async () => true },
			sessions,
			reliability,
			assessments,
			qualification
		);

		const completed = await service.complete({
			jobId: job.id,
			machineId: MACHINE_ID,
			machineSessionId: CURRENT_SESSION_ID,
			status: JobStatus.FAILED,
			leaseToken: LEASE_TOKEN,
			attempt: ATTEMPT,
			errorMessage: 'the machine benchmark image is unavailable',
			executionResult: {
				...SUCCEEDED,
				outcome: JOB_EXECUTION_OUTCOME.FAILED,
				errorCode: JobErrorCode.IMAGE_UNAVAILABLE,
			},
		});

		assert.equal(completed.status, JobStatus.FAILED);
		assert.equal(recorded.mock.callCount(), 0);
		assert.equal(assessed.mock.callCount(), 0);
	});
});
