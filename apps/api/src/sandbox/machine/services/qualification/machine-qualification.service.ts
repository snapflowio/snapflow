/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes } from 'node:crypto';
import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { v4 } from 'uuid';
import { MACHINE_QUALIFICATION_LOCK_NAMESPACE } from '../../../../common/constants/advisory-lock.constants';
import { canonicalJson } from '../../../../common/utils/canonical-json.util';
import { addSeconds } from '../../../../common/utils/time.util';
import { lockAdvisoryKey } from '../../../../infra/database/utils/advisory-lock.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { findCurrentMachineAssessment } from '../../../../marketplace/machine/queries/machine-assessment.query';
import { Job } from '../../../machine-job/entities/job.entity';
import { JobStatus } from '../../../machine-job/enums/job-status.enum';
import { JobType } from '../../../machine-job/enums/job-type.enum';
import { ResourceType } from '../../../machine-job/enums/resource-type.enum';
import {
	MACHINE_QUALIFICATION_CANARY_SNAPSHOT,
	MACHINE_QUALIFICATION_CHECK,
	MACHINE_QUALIFICATION_LIMITS,
	MACHINE_QUALIFICATION_POLICY,
	MACHINE_QUALIFICATION_RATE_LIMIT,
	MACHINE_QUALIFICATION_REASON,
	MACHINE_QUALIFICATION_SCHEMA_VERSION,
	MACHINE_QUALIFICATION_STATE,
} from '../../constants/machine-qualification.constants';
import type { Machine } from '../../entities/machine.entity';
import { MachineAssessment } from '../../entities/machine-assessment.entity';
import { MachineQualificationChallenge } from '../../entities/machine-qualification-challenge.entity';
import type { MachineSession } from '../../entities/machine-session.entity';
import { machineTrustCoolingDown } from '../../utils/qualification/machine-assessment.util';
import {
	machineQualificationInputFingerprint,
	machineQualificationRenewalDue,
	sha256,
} from '../../utils/qualification/machine-qualification.util';
import { MachineJobNotificationService } from '../machine-job-notification.service';
import { MachineSessionService } from '../machine-session.service';

const QUALIFICATION_CLASS = 'functional';

interface QualificationJobPayload {
	schemaVersion: number;
	policyVersion: number;
	audience: string;
	challengeId: string;
	machineId: string;
	sessionId: string;
	sessionGeneration: number;
	machineKeyId: string;
	nonce: string;
	inputFingerprint: string;
	issuedAt: string;
	expiresAt: string;
	requestedCheckIds: string[];
	workLimits: Record<string, number>;
	canary: {
		snapshot: string;
		cpu: number;
		memoryGiB: number;
		storageGiB: number;
	};
}

interface ChallengeOptions {
	inputFingerprint: string;
	releaseDigest: string;
	canarySnapshot: string;
	now: Date;
}

interface QualificationPayloadInput
	extends Omit<ChallengeOptions, 'releaseDigest'> {
	machineId: string;
	session: MachineSession;
	machineKeyId: string;
	nonce: string;
	expiresAt: Date;
}

function qualificationJobPayload(
	input: QualificationPayloadInput
): QualificationJobPayload {
	return {
		schemaVersion: MACHINE_QUALIFICATION_SCHEMA_VERSION,
		policyVersion: MACHINE_QUALIFICATION_POLICY.VERSION,
		audience: MACHINE_QUALIFICATION_POLICY.AUDIENCE,
		challengeId: v4(),
		machineId: input.machineId,
		sessionId: input.session.id,
		sessionGeneration: input.session.generation,
		machineKeyId: input.machineKeyId,
		nonce: input.nonce,
		inputFingerprint: input.inputFingerprint,
		issuedAt: input.now.toISOString(),
		expiresAt: input.expiresAt.toISOString(),
		requestedCheckIds: Object.values(MACHINE_QUALIFICATION_CHECK),
		workLimits: {
			maximumDurationSeconds:
				MACHINE_QUALIFICATION_POLICY.MAXIMUM_DURATION_SECONDS,
			diskSampleBytes: MACHINE_QUALIFICATION_POLICY.DISK_SAMPLE_BYTES,
			cpuIterations: MACHINE_QUALIFICATION_POLICY.CPU_ITERATIONS,
		},
		canary: {
			snapshot: input.canarySnapshot,
			cpu: MACHINE_QUALIFICATION_POLICY.CANARY_CPU,
			memoryGiB: MACHINE_QUALIFICATION_POLICY.CANARY_MEMORY_GIB,
			storageGiB: MACHINE_QUALIFICATION_POLICY.CANARY_STORAGE_GIB,
		},
	};
}

@Injectable()
export class MachineQualificationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly sessionService: MachineSessionService,
		private readonly notifications: MachineJobNotificationService
	) {}

	async ensureChallenge(
		machineId: string,
		session: MachineSession
	): Promise<void> {
		const job = await this.entityManager.transactional(
			async (manager) => {
				await lockAdvisoryKey(
					manager,
					machineId,
					MACHINE_QUALIFICATION_LOCK_NAMESPACE
				);
				const machine = await this.sessionService.assertCurrent(
					manager,
					machineId,
					session.id
				);
				if (!machine.identityKeyId || !machine.runtimeCapabilities) return null;
				const now = await databaseNow(manager);
				const options: ChallengeOptions = {
					inputFingerprint: machineQualificationInputFingerprint(machine),
					releaseDigest: machine.runtimeCapabilities.machineReleaseDigest,
					canarySnapshot: MACHINE_QUALIFICATION_CANARY_SNAPSHOT,
					now,
				};
				if (!(await this.needsChallenge(manager, machineId, options))) {
					return null;
				}
				if (!(await this.mayIssue(manager, machineId, session, now)))
					return null;
				return this.createChallenge(manager, machine, session, options);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		if (job) this.notifications.notify(job.machineId, job.id);
	}

	private async needsChallenge(
		manager: EntityManager,
		machineId: string,
		{ inputFingerprint, releaseDigest, now }: Readonly<ChallengeOptions>
	): Promise<boolean> {
		const assessment = await manager.findOne(MachineAssessment, { machineId });
		if (machineTrustCoolingDown(assessment, now)) return false;
		const current = await findCurrentMachineAssessment(manager, machineId);
		if (!current) return true;
		const accepted = await manager.findOne(
			MachineQualificationChallenge,
			{ machineId, state: MACHINE_QUALIFICATION_STATE.ACCEPTED },
			{ orderBy: { completedAt: 'DESC' } }
		);
		return (
			!accepted?.completedAt ||
			accepted.inputFingerprint !== inputFingerprint ||
			accepted.releaseDigest !== releaseDigest ||
			machineQualificationRenewalDue(accepted.completedAt, now)
		);
	}

	private async mayIssue(
		manager: EntityManager,
		machineId: string,
		session: MachineSession,
		now: Date
	): Promise<boolean> {
		const pending = await manager.findOne(
			MachineQualificationChallenge,
			{ machineId, state: MACHINE_QUALIFICATION_STATE.PENDING },
			{ orderBy: { issuedAt: 'DESC' } }
		);
		if (
			pending &&
			pending.machineSessionId === session.id &&
			pending.expiresAt > now
		) {
			return false;
		}
		if (pending) {
			pending.state = MACHINE_QUALIFICATION_STATE.EXPIRED;
			pending.reasonCode = MACHINE_QUALIFICATION_REASON.EXPIRED;
		}
		const intervalStart = addSeconds(
			now,
			-MACHINE_QUALIFICATION_RATE_LIMIT.MINIMUM_INTERVAL_SECONDS
		);
		const issuedRecently = await manager.count(MachineQualificationChallenge, {
			machineId,
			issuedAt: { $gt: intervalStart },
		});
		return issuedRecently === 0;
	}

	private createChallenge(
		manager: EntityManager,
		machine: Machine,
		session: MachineSession,
		{
			inputFingerprint,
			releaseDigest,
			canarySnapshot,
			now,
		}: Readonly<ChallengeOptions>
	): Job {
		const machineKeyId = machine.identityKeyId;
		if (!machineKeyId) {
			throw new Error('Machine qualification requires an enrolled machine key');
		}
		const nonce = randomBytes(
			MACHINE_QUALIFICATION_LIMITS.NONCE_BYTES
		).toString('base64url');
		const expiresAt = addSeconds(
			now,
			MACHINE_QUALIFICATION_POLICY.CHALLENGE_TTL_SECONDS
		);
		const payload = qualificationJobPayload({
			machineId: machine.id,
			session,
			machineKeyId,
			nonce,
			inputFingerprint,
			canarySnapshot,
			now,
			expiresAt,
		});
		const job = new Job({
			type: JobType.QUALIFY_MACHINE,
			machineId: machine.id,
			resourceType: ResourceType.MACHINE,
			resourceId: payload.challengeId,
			status: JobStatus.PENDING,
			payload: canonicalJson(payload),
			traceContext: null,
		});
		const challenge = new MachineQualificationChallenge();
		Object.assign(challenge, {
			id: payload.challengeId,
			machineId: machine.id,
			machineSessionId: session.id,
			machineSessionGeneration: session.generation,
			machineKeyId,
			jobId: job.id,
			schemaVersion: payload.schemaVersion,
			policyVersion: payload.policyVersion,
			qualificationClass: QUALIFICATION_CLASS,
			requestedCheckIds: payload.requestedCheckIds,
			workLimits: payload.workLimits,
			canarySnapshot: payload.canary.snapshot,
			nonceDigest: sha256(nonce),
			requestDigest: sha256(canonicalJson(payload)),
			inputFingerprint,
			releaseDigest,
			state: MACHINE_QUALIFICATION_STATE.PENDING,
			reasonCode: null,
			issuedAt: now,
			expiresAt,
			consumedAt: null,
			completedAt: null,
			createdAt: now,
		} satisfies Partial<MachineQualificationChallenge>);
		manager.persist([job, challenge]);
		return job;
	}
}
