/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Sandbox } from '../../../instance/entities/sandbox.entity';
import { SandboxPlacement } from '../../../instance/entities/sandbox-placement.entity';
import { Job } from '../../../machine-job/entities/job.entity';
import { JobStatus } from '../../../machine-job/enums/job-status.enum';
import { ResourceType } from '../../../machine-job/enums/resource-type.enum';
import type { JobExecutionResult } from '../../../machine-job/types/job-execution-result.types';
import {
	JOB_EXECUTION_OUTCOME,
	JOB_LIFECYCLE_PHASE,
	type JobLifecyclePhase,
	MACHINE_ATTRIBUTION_SUBJECT,
	MACHINE_FAULT_DOMAIN,
	MACHINE_RELIABILITY_EVENT_KIND,
	MACHINE_RELIABILITY_OUTCOME,
	MACHINE_RELIABILITY_SOURCE,
	MACHINE_WORKLOAD_OUTCOME_CLASS,
	MACHINE_WORKLOAD_OUTCOME_REFRESH_MINUTES,
	type MachineAttributionSubject,
	type MachineFaultDomain,
	type MachineReliabilityEventKind,
	type MachineReliabilityOutcome,
	type MachineReliabilitySource,
	PLATFORM_RELIABILITY_REASON,
} from '../../constants/machine-reliability.constants';
import { Machine } from '../../entities/machine.entity';
import { MachineReliabilityEvent } from '../../entities/machine-reliability-event.entity';
import {
	reliabilityEvidenceDigest,
	reliabilitySeverity,
	reportedFaultDomain,
	reportedOutcome,
	sandboxWorkloadFingerprint,
	sanitizeEvidence,
} from '../../utils/qualification/machine-reliability-evidence.util';

const SUBJECT_OUTCOME_UPSERT_SQL = `INSERT INTO machine_workload_outcome ("subjectKind", subject, host, "outcomeClass", "lastObservedAt")
	VALUES (?, ?, ?, ?, ?)
	ON CONFLICT ("subjectKind", subject, host, "outcomeClass") DO UPDATE
	SET "lastObservedAt" = excluded."lastObservedAt"
	WHERE machine_workload_outcome."lastObservedAt" < excluded."lastObservedAt" - (? * interval '1 minute')`;

export interface SandboxConvergenceRecord {
	placement: SandboxPlacement;
	sandbox: Sandbox;
	machineSessionId: string;
	specGeneration: number;
	result: JobExecutionResult;
	observedAt: Date;
}

const PLATFORM_PLACEMENT_OBSERVATION = {
	[MACHINE_RELIABILITY_EVENT_KIND.CONVERGENCE_DEADLINE_MISSED]: {
		reasonCode: PLATFORM_RELIABILITY_REASON.CONVERGENCE_DEADLINE_MISSED,
		outcome: MACHINE_RELIABILITY_OUTCOME.FAILURE,
		perGeneration: true,
	},
	[MACHINE_RELIABILITY_EVENT_KIND.CREATE_UNOBSERVED]: {
		reasonCode: PLATFORM_RELIABILITY_REASON.CREATE_UNOBSERVED,
		outcome: MACHINE_RELIABILITY_OUTCOME.FAILURE,
		perGeneration: true,
	},
	[MACHINE_RELIABILITY_EVENT_KIND.EDGE_SERVED]: {
		reasonCode: PLATFORM_RELIABILITY_REASON.EDGE_SERVED,
		outcome: MACHINE_RELIABILITY_OUTCOME.SUCCESS,
		perGeneration: false,
	},
} as const;

export type PlatformPlacementObservationKind =
	keyof typeof PLATFORM_PLACEMENT_OBSERVATION;

interface ReliabilityEvidence {
	machineId: string;
	machineSessionId: string | null;
	placement: SandboxPlacement | null;
	sandbox: Sandbox | null;
	jobId: string | null;
	jobAttempt: number | null;
	specGeneration: number | null;
	eventKind: MachineReliabilityEventKind;
	source: MachineReliabilitySource;
	phase: JobLifecyclePhase;
	outcome: MachineReliabilityOutcome;
	faultDomain: MachineFaultDomain;
	reasonCode: string;
	deduplicationKey: string;
	attemptIdentity: Record<string, string | number | null>;
	result: JobExecutionResult | null;
	observedAt: Date;
}

@Injectable()
export class MachineReliabilityService {
	async recordJobCompletion(
		manager: EntityManager,
		job: Job,
		result: JobExecutionResult,
		observedAt: Date
	): Promise<boolean> {
		const expectedOutcome =
			job.status === JobStatus.COMPLETED
				? JOB_EXECUTION_OUTCOME.SUCCEEDED
				: JOB_EXECUTION_OUTCOME.FAILED;
		if (result.outcome !== expectedOutcome) {
			throw new Error(
				'Machine execution result contradicts the terminal job status'
			);
		}
		const { placement, sandbox } = await this.jobSubject(manager, job);
		const acceptedAttempt = job.acceptedAttempt ?? job.attempt;
		const faultDomain = reportedFaultDomain(result);
		return this.record(manager, {
			machineId: job.machineId,
			machineSessionId: job.acceptedSessionId,
			placement,
			sandbox,
			jobId: job.id,
			jobAttempt: acceptedAttempt,
			specGeneration: null,
			eventKind: MACHINE_RELIABILITY_EVENT_KIND.JOB_COMPLETION,
			source: MACHINE_RELIABILITY_SOURCE.MACHINE,
			phase: result.phase,
			outcome: reportedOutcome(result, faultDomain),
			faultDomain,
			reasonCode: result.errorCode,
			deduplicationKey: `job:${job.id}:attempt:${acceptedAttempt}`,
			attemptIdentity: {
				jobId: job.id,
				attempt: acceptedAttempt,
				leaseToken: job.acceptedLeaseToken,
				sessionId: job.acceptedSessionId,
				assignmentGeneration: placement?.assignmentGeneration ?? null,
			},
			result,
			observedAt,
		});
	}

	async recordSandboxConvergence(
		manager: EntityManager,
		convergence: SandboxConvergenceRecord
	): Promise<boolean> {
		const { placement, sandbox, specGeneration, result } = convergence;
		const faultDomain = reportedFaultDomain(result);
		return this.record(manager, {
			machineId: placement.machineId,
			machineSessionId: convergence.machineSessionId,
			placement,
			sandbox,
			jobId: null,
			jobAttempt: null,
			specGeneration,
			eventKind: MACHINE_RELIABILITY_EVENT_KIND.SANDBOX_CONVERGENCE,
			source: MACHINE_RELIABILITY_SOURCE.MACHINE,
			phase: result.phase,
			outcome: reportedOutcome(result, faultDomain),
			faultDomain,
			reasonCode: result.errorCode,
			deduplicationKey: `sandbox:${sandbox.id}:assignment:${placement.assignmentGeneration}:generation:${specGeneration}:${result.outcome}`,
			attemptIdentity: {
				sandboxId: sandbox.id,
				assignmentGeneration: placement.assignmentGeneration,
				specGeneration,
				outcome: result.outcome,
			},
			result,
			observedAt: convergence.observedAt,
		});
	}

	async recordLeaseExpiry(
		manager: EntityManager,
		job: Job,
		observedAt: Date
	): Promise<boolean> {
		const { placement, sandbox } = await this.jobSubject(manager, job);
		return this.record(manager, {
			...platformObservation(placement, sandbox, observedAt),
			machineId: job.machineId,
			machineSessionId: job.leasedBySessionId,
			jobId: job.id,
			jobAttempt: job.attempt,
			specGeneration: null,
			eventKind: MACHINE_RELIABILITY_EVENT_KIND.LEASE_EXPIRED,
			reasonCode: PLATFORM_RELIABILITY_REASON.LEASE_EXPIRED,
			deduplicationKey: `job:${job.id}:attempt:${job.attempt}:lease-expired`,
			attemptIdentity: { jobId: job.id, attempt: job.attempt },
		});
	}

	async recordPlacementObservation(
		manager: EntityManager,
		kind: PlatformPlacementObservationKind,
		placement: SandboxPlacement,
		sandbox: Sandbox,
		observedAt: Date
	): Promise<boolean> {
		const observation = PLATFORM_PLACEMENT_OBSERVATION[kind];
		const base = platformObservation(placement, sandbox, observedAt);
		return this.record(manager, {
			...base,
			outcome: observation.outcome,
			faultDomain:
				observation.outcome === MACHINE_RELIABILITY_OUTCOME.SUCCESS
					? MACHINE_FAULT_DOMAIN.UNKNOWN
					: base.faultDomain,
			machineId: placement.machineId,
			machineSessionId: null,
			jobId: null,
			jobAttempt: null,
			specGeneration: sandbox.specGeneration,
			eventKind: kind,
			reasonCode: observation.reasonCode,
			deduplicationKey: observation.perGeneration
				? `placement:${placement.id}:generation:${sandbox.specGeneration}:${kind}`
				: `placement:${placement.id}:${kind}`,
			attemptIdentity: {
				placementId: placement.id,
				specGeneration: sandbox.specGeneration,
			},
		});
	}

	private async jobSubject(
		manager: EntityManager,
		job: Job
	): Promise<{ placement: SandboxPlacement | null; sandbox: Sandbox | null }> {
		if (job.resourceType !== ResourceType.SANDBOX) {
			return { placement: null, sandbox: null };
		}
		return {
			placement: await manager.findOne(
				SandboxPlacement,
				{ sandboxId: job.resourceId, machineId: job.machineId },
				{ orderBy: { placedAt: 'DESC' } }
			),
			sandbox: await manager.findOne(Sandbox, { id: job.resourceId }),
		};
	}

	private async record(
		manager: EntityManager,
		evidence: ReliabilityEvidence
	): Promise<boolean> {
		const sanitizedEvidence = sanitizeEvidence(evidence.result?.evidence);
		const machine = await manager.findOne(
			Machine,
			{ id: evidence.machineId },
			{ fields: ['organizationId'] }
		);
		const workloadFingerprint = sandboxWorkloadFingerprint(evidence.sandbox);
		const selfDealt = Boolean(
			machine?.organizationId &&
				evidence.sandbox?.organizationId === machine.organizationId
		);
		const result = await manager
			.createQueryBuilder(MachineReliabilityEvent)
			.insert({
				machineId: evidence.machineId,
				placementId: evidence.placement?.id ?? null,
				sandboxId: evidence.sandbox?.id ?? null,
				jobId: evidence.jobId,
				jobAttempt: evidence.jobAttempt,
				specGeneration: evidence.specGeneration,
				machineSessionId: evidence.machineSessionId,
				assignmentGeneration: evidence.placement?.assignmentGeneration ?? null,
				workloadFingerprint,
				eventKind: evidence.eventKind,
				source: evidence.source,
				selfDealt,
				customerOrganizationId: evidence.sandbox?.organizationId ?? null,
				phase: evidence.phase,
				outcome: evidence.outcome,
				severity: reliabilitySeverity(evidence.outcome),
				reasonCode: evidence.reasonCode,
				faultDomain: evidence.faultDomain,
				deduplicationKey: evidence.deduplicationKey,
				evidenceDigest: reliabilityEvidenceDigest(
					evidence.attemptIdentity,
					evidence.result,
					sanitizedEvidence
				),
				evidence: sanitizedEvidence,
				observedAt: evidence.observedAt,
			})
			.onConflict(['deduplicationKey'])
			.ignore()
			.execute('run');
		if (result.affectedRows === 0) return false;
		if (!selfDealt) {
			await this.noteSubjectOutcomes(
				manager,
				evidence,
				{
					[MACHINE_ATTRIBUTION_SUBJECT.WORKLOAD]: workloadFingerprint,
					[MACHINE_ATTRIBUTION_SUBJECT.CUSTOMER]:
						evidence.sandbox?.organizationId ?? null,
				},
				machine?.organizationId ?? evidence.machineId
			);
		}
		return true;
	}

	private async noteSubjectOutcomes(
		manager: EntityManager,
		evidence: ReliabilityEvidence,
		subjects: Record<MachineAttributionSubject, string | null>,
		host: string
	): Promise<void> {
		const outcomeClass =
			evidence.outcome === MACHINE_RELIABILITY_OUTCOME.SUCCESS
				? MACHINE_WORKLOAD_OUTCOME_CLASS.SUCCESS
				: MACHINE_WORKLOAD_OUTCOME_CLASS.FAILURE;
		for (const [subjectKind, subject] of Object.entries(subjects)) {
			if (subject === null) continue;
			await manager.execute(SUBJECT_OUTCOME_UPSERT_SQL, [
				subjectKind,
				subject,
				host,
				outcomeClass,
				evidence.observedAt,
				MACHINE_WORKLOAD_OUTCOME_REFRESH_MINUTES,
			]);
		}
	}
}

function platformObservation(
	placement: SandboxPlacement | null,
	sandbox: Sandbox | null,
	observedAt: Date
) {
	return {
		placement,
		sandbox,
		source: MACHINE_RELIABILITY_SOURCE.PLATFORM,
		phase: JOB_LIFECYCLE_PHASE.UNKNOWN,
		outcome: MACHINE_RELIABILITY_OUTCOME.FAILURE,
		faultDomain: MACHINE_FAULT_DOMAIN.MACHINE,
		result: null,
		observedAt,
	} satisfies Partial<ReliabilityEvidence>;
}
