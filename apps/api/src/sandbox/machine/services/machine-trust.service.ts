/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { CursorPage } from '../../../common/dto/cursor-page.dto';
import { findCursorPage } from '../../../common/utils/pagination/cursor-page.util';
import type {
	MachineReliabilityEventDto,
	MachineTrustDto,
} from '../dto/machine-trust.dto';
import { MachineAssessment } from '../entities/machine-assessment.entity';
import { MachineQualificationChallenge } from '../entities/machine-qualification-challenge.entity';
import { MachineQualificationEvidence } from '../entities/machine-qualification-evidence.entity';
import { MachineReliabilityEvent } from '../entities/machine-reliability-event.entity';
import { machineExcludedWorkloadCount } from '../queries/machine-placement-trust.query';

@Injectable()
export class MachineTrustService {
	constructor(private readonly entityManager: EntityManager) {}

	async getMachineTrust(machineId: string): Promise<MachineTrustDto> {
		const assessment = await this.entityManager.findOne(MachineAssessment, {
			machineId,
		});
		if (!assessment) {
			throw new NotFoundException('Machine assessment not found');
		}
		const challenge = await this.entityManager.findOne(
			MachineQualificationChallenge,
			{ machineId },
			{ orderBy: { issuedAt: 'DESC' } }
		);
		const evidence = challenge
			? await this.entityManager.findOne(MachineQualificationEvidence, {
					challengeId: challenge.id,
				})
			: null;
		return {
			machineId,
			qualified: assessment.qualified,
			trustStage: assessment.trustStage,
			reliabilityBasisPoints: assessment.reliabilityBasisPoints,
			healthBasisPoints: assessment.healthBasisPoints,
			attestationBasisPoints: assessment.attestationBasisPoints,
			uptimeBasisPoints: assessment.uptimeBasisPoints,
			platformObservedEventCount: assessment.platformObservedEventCount,
			successfulSamples: assessment.successfulSamples,
			machineAttributableFailures: assessment.machineAttributableFailures,
			unattributedFailureCount: assessment.unattributedFailureCount,
			neutralEventCount: assessment.neutralEventCount,
			quarantinedLineCount: assessment.quarantinedLineCount,
			reconciledWindowCount: assessment.reconciledWindowCount,
			excludedWorkloadCount: await machineExcludedWorkloadCount(
				this.entityManager,
				machineId
			),
			restrictionReason: assessment.restrictionReason,
			restrictedUntil: assessment.restrictedUntil?.toISOString() ?? null,
			probationEndsAt: assessment.probationEndsAt?.toISOString() ?? null,
			relapseCount: assessment.relapseCount,
			qualificationReasons: assessment.qualificationReasons,
			qualificationExpiresAt:
				assessment.qualificationExpiresAt?.toISOString() ?? null,
			observationWindowStartedAt:
				assessment.observationWindowStartedAt?.toISOString() ?? null,
			observationWindowEndedAt:
				assessment.observationWindowEndedAt?.toISOString() ?? null,
			qualificationState: challenge?.state ?? null,
			qualificationReason: challenge?.reasonCode ?? null,
			qualificationChecks: evidence?.checkResults ?? [],
		};
	}

	async listReliabilityEvents(
		machineId: string,
		limit: number,
		cursor?: string
	): Promise<CursorPage<MachineReliabilityEventDto>> {
		const page = await findCursorPage(
			this.entityManager,
			MachineReliabilityEvent,
			{
				where: { machineId },
				orderBy: {
					observedAt: QueryOrder.DESC,
					id: QueryOrder.DESC,
				},
				limit,
				cursor,
			}
		);
		return { ...page, items: page.items.map(reliabilityEventDto) };
	}
}

function reliabilityEventDto(
	event: MachineReliabilityEvent
): MachineReliabilityEventDto {
	return {
		id: event.id,
		machineId: event.machineId,
		jobId: event.jobId,
		jobAttempt: event.jobAttempt,
		sandboxId: event.sandboxId,
		specGeneration: event.specGeneration,
		faultDomain: event.faultDomain,
		phase: event.phase,
		outcome: event.outcome,
		severity: event.severity,
		reasonCode: event.reasonCode,
		evidenceDigest: event.evidenceDigest,
		evidence: event.evidence,
		source: event.source,
		selfDealt: event.selfDealt,
		eventKind: event.eventKind,
		observedAt: event.observedAt.toISOString(),
	};
}
