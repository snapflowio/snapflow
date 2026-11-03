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
import {
	MACHINE_TRUST_POLICY,
	MachineTrustStage,
} from '../../../../billing/ledger/constants/machine-trust.constants';
import { MACHINE_ASSESSMENT_LOCK_NAMESPACE } from '../../../../common/constants/advisory-lock.constants';
import { MILLISECONDS_PER_DAY } from '../../../../common/constants/time.constants';
import { addMilliseconds } from '../../../../common/utils/time.util';
import { lockAdvisoryKey } from '../../../../infra/database/utils/advisory-lock.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import {
	MACHINE_QUALIFICATION_POLICY,
	MACHINE_QUALIFICATION_STATE,
} from '../../constants/machine-qualification.constants';
import { Machine } from '../../entities/machine.entity';
import { MachineAssessment } from '../../entities/machine-assessment.entity';
import { MachineObservation } from '../../entities/machine-observation.entity';
import { MachineQualificationChallenge } from '../../entities/machine-qualification-challenge.entity';
import { refreshMachinePlacementTimings } from '../../queries/machine-placement-timing.query';
import {
	type MachineTrustTally,
	machineTrustTally,
	peerFailureRate,
} from '../../queries/machine-trust.query';
import { uptimeBasisPoints } from '../../utils/machine-uptime.util';
import {
	machineQualificationExpiresAt,
	machineQualificationInputFingerprint,
} from '../../utils/qualification/machine-qualification.util';
import { failureMass } from '../../utils/qualification/machine-trust-evaluation.util';
import {
	decideMachineTrust,
	type MachineBreakerState,
	type MachineTrustDecision,
	machinePlacementWindow,
} from '../../utils/qualification/machine-trust-policy.util';

const MACHINE_ASSESSMENT_REASON = {
	MACHINE_IDENTITY_MISSING: 'machine_identity_missing',
	CAPACITY_OBSERVATION_MISSING: 'capacity_observation_missing',
	KVM_UNAVAILABLE: 'kvm_unavailable',
	FUNCTIONAL_QUALIFICATION_REQUIRED: 'functional_qualification_required',
} as const;

interface AssessmentInputs {
	machine: Machine | null;
	observation: MachineObservation | null;
	qualification: MachineQualificationChallenge | null;
	qualificationExpiresAt: Date | null;
	assessedAt: Date;
}

interface AssessmentOutcome {
	machineId: string;
	inputs: AssessmentInputs;
	tally: MachineTrustTally;
	decision: MachineTrustDecision;
	uptime: number;
	windowStartedAt: Date;
}

@Injectable()
export class MachineAssessmentService {
	async assess(manager: EntityManager, machineId: string): Promise<void> {
		await lockAdvisoryKey(
			manager,
			machineId,
			MACHINE_ASSESSMENT_LOCK_NAMESPACE
		);
		const current = await manager.findOne(
			MachineAssessment,
			{ machineId },
			{ refresh: true }
		);
		const inputs = await this.loadInputs(manager, machineId);
		const previous = breakerState(current);
		const windowStartedAt = addMilliseconds(
			inputs.assessedAt,
			-MACHINE_TRUST_POLICY.observationWindowDays * MILLISECONDS_PER_DAY
		);
		const tally = await machineTrustTally(
			manager,
			machineId,
			previous.evidenceSince && previous.evidenceSince > windowStartedAt
				? previous.evidenceSince
				: windowStartedAt
		);
		await refreshMachinePlacementTimings(manager, machineId);
		const uptime = uptimeBasisPoints({
			onlineSeconds: inputs.observation?.uptimeOnlineSeconds ?? 0,
			observedSeconds: inputs.observation?.uptimeObservedSeconds ?? 0,
		});
		const decision = decideMachineTrust({
			previous,
			window: tally.window,
			recent: tally.recent,
			recentFraudulentLines: tally.recentFraudulentLines,
			recentPlatformSuccesses: tally.recentPlatformSuccesses,
			qualifiedAt: inputs.qualification?.completedAt ?? null,
			peerFailureRate: await peerFailureRate(manager, machineId),
			uptimeBasisPoints: uptime,
			now: inputs.assessedAt,
		});
		const assessment = current ?? new MachineAssessment();
		Object.assign(
			assessment,
			assessmentFields({
				machineId,
				inputs,
				tally,
				decision,
				uptime,
				windowStartedAt,
			})
		);
		if (!current) manager.persist(assessment);
		await manager.flush();
	}

	private async loadInputs(
		manager: EntityManager,
		machineId: string
	): Promise<AssessmentInputs> {
		const assessedAt = await databaseNow(manager);
		const qualification = await manager.findOne(
			MachineQualificationChallenge,
			{ machineId, state: MACHINE_QUALIFICATION_STATE.ACCEPTED },
			{ orderBy: { completedAt: 'DESC' } }
		);
		return {
			machine: await manager.findOne(Machine, { id: machineId }),
			observation: await manager.findOne(MachineObservation, { machineId }),
			qualification,
			qualificationExpiresAt: qualification?.completedAt
				? machineQualificationExpiresAt(qualification.completedAt)
				: null,
			assessedAt,
		};
	}
}

function assessmentFields(
	outcome: AssessmentOutcome
): Partial<MachineAssessment> {
	const { inputs, tally, decision } = outcome;
	const reasons = [...hostReasons(inputs), ...decision.holdReasons];
	return {
		machineId: outcome.machineId,
		qualified: reasons.length === 0,
		reliabilityBasisPoints: decision.window.reliabilityBasisPoints,
		attestationBasisPoints: decision.window.attestationBasisPoints,
		healthBasisPoints: decision.recent.healthBasisPoints,
		uptimeBasisPoints: outcome.uptime,
		historicalSampleSize:
			tally.counts.successful + tally.counts.machineFailures,
		successfulSamples: tally.counts.successful,
		successMass: tally.window.outcomes.successful,
		failureMass: failureMass(tally.window.outcomes),
		placementWindow: machinePlacementWindow(
			decision.trustStage,
			tally.counts.successful,
			tally.recentPlatformSuccesses
		),
		machineAttributableFailures: tally.counts.machineFailures,
		unattributedFailureCount: tally.counts.unattributedFailures,
		neutralEventCount: tally.counts.neutral,
		platformObservedEventCount: tally.counts.platformObserved,
		quarantinedLineCount: tally.counts.fraudulentLines,
		reconciledWindowCount: tally.counts.reconciledWindows,
		trustStage: decision.trustStage,
		restrictionReason: decision.restrictionReason,
		restrictedUntil: decision.restrictedUntil,
		probationEndsAt: decision.probationEndsAt,
		evidenceSince: decision.evidenceSince,
		releasedAt: decision.releasedAt,
		relapseCount: decision.relapseCount,
		qualificationExpiresAt: inputs.qualificationExpiresAt,
		qualificationPolicyVersion: inputs.qualification?.policyVersion ?? null,
		observationWindowStartedAt: outcome.windowStartedAt,
		observationWindowEndedAt: inputs.assessedAt,
		policyVersion: MACHINE_TRUST_POLICY.version,
		qualificationReasons: reasons,
		assessedAt: inputs.assessedAt,
	};
}

function breakerState(current: MachineAssessment | null): MachineBreakerState {
	return {
		trustStage: current?.trustStage ?? MachineTrustStage.PROBATIONARY,
		restrictedUntil: current?.restrictedUntil ?? null,
		probationEndsAt: current?.probationEndsAt ?? null,
		evidenceSince: current?.evidenceSince ?? null,
		releasedAt: current?.releasedAt ?? null,
		relapseCount: current?.relapseCount ?? 0,
		restrictionReason: current?.restrictionReason ?? null,
	};
}

function hostReasons(inputs: AssessmentInputs): string[] {
	const { machine, observation, qualification } = inputs;
	const reasons: string[] = [];
	if (!machine?.identityKeyId) {
		reasons.push(MACHINE_ASSESSMENT_REASON.MACHINE_IDENTITY_MISSING);
	}
	if (
		!observation ||
		observation.cpu <= 0 ||
		observation.memoryGiB <= 0 ||
		observation.diskGiB <= 0
	) {
		reasons.push(MACHINE_ASSESSMENT_REASON.CAPACITY_OBSERVATION_MISSING);
	}
	if (!machine?.runtimeCapabilities?.kvmAvailable) {
		reasons.push(MACHINE_ASSESSMENT_REASON.KVM_UNAVAILABLE);
	}
	if (
		!machine ||
		!qualification ||
		qualification.policyVersion !== MACHINE_QUALIFICATION_POLICY.VERSION ||
		!inputs.qualificationExpiresAt ||
		inputs.qualificationExpiresAt <= inputs.assessedAt ||
		qualification.inputFingerprint !==
			machineQualificationInputFingerprint(machine)
	) {
		reasons.push(MACHINE_ASSESSMENT_REASON.FUNCTIONAL_QUALIFICATION_REQUIRED);
	}
	return reasons;
}
