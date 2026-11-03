/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	MachineRestrictionReason,
	MachineTrustStage,
} from '../../../billing/ledger/constants/machine-trust.constants';
import { CursorPageDto } from '../../../common/dto/cursor-page.dto';
import {
	MACHINE_QUALIFICATION_STATE,
	type MachineQualificationState,
} from '../constants/machine-qualification.constants';
import {
	JOB_LIFECYCLE_PHASE,
	type JobLifecyclePhase,
	MACHINE_FAULT_DOMAIN,
	MACHINE_RELIABILITY_OUTCOME,
	MACHINE_RELIABILITY_SEVERITY,
	MACHINE_RELIABILITY_SOURCE,
	type MachineFaultDomain,
	type MachineReliabilityOutcome,
	type MachineReliabilitySeverity,
	type MachineReliabilitySource,
} from '../constants/machine-reliability.constants';

export class MachineQualificationCheckDto {
	@ApiProperty() checkId: string;
	@ApiProperty() passed: boolean;
	@ApiProperty() durationMs: number;
	@ApiProperty() reasonCode: string;
}

export class MachineTrustDto {
	@ApiProperty() machineId: string;
	@ApiProperty() qualified: boolean;
	@ApiProperty({
		enum: Object.values(MachineTrustStage),
		enumName: 'MachineTrustStage',
	})
	trustStage: MachineTrustStage;
	@ApiProperty({
		description:
			'Lower confidence bound of the decayed success share, in basis points',
	})
	reliabilityBasisPoints: number;
	@ApiProperty({
		description:
			'Recent health the trust circuit breaker restricts below, in basis points',
	})
	healthBasisPoints: number;
	@ApiProperty({
		description:
			"Share of the machine's billed compute its signed receipts attested, in basis points",
	})
	attestationBasisPoints: number;
	@ApiProperty({
		description:
			'Decayed share of time the platform saw the machine online, in basis points',
	})
	uptimeBasisPoints: number;
	@ApiProperty({
		description:
			'Window events the platform observed itself rather than the machine reported',
	})
	platformObservedEventCount: number;
	@ApiProperty() successfulSamples: number;
	@ApiProperty() machineAttributableFailures: number;
	@ApiProperty() unattributedFailureCount: number;
	@ApiProperty() neutralEventCount: number;
	@ApiProperty({
		description:
			'Billing lines quarantined from billing because evidence the machine signed failed audit',
	})
	quarantinedLineCount: number;
	@ApiProperty() reconciledWindowCount: number;
	@ApiProperty({
		description: 'Workloads the machine is kept off after failing them',
	})
	excludedWorkloadCount: number;
	@ApiPropertyOptional({
		nullable: true,
		enum: Object.values(MachineRestrictionReason),
		enumName: 'MachineRestrictionReason',
	})
	restrictionReason: MachineRestrictionReason | null;
	@ApiPropertyOptional({ nullable: true, type: String })
	restrictedUntil: string | null;
	@ApiPropertyOptional({ nullable: true, type: String })
	probationEndsAt: string | null;
	@ApiProperty() relapseCount: number;
	@ApiProperty({ type: [String] }) qualificationReasons: string[];
	@ApiPropertyOptional({ nullable: true, type: String })
	qualificationExpiresAt: string | null;
	@ApiPropertyOptional({ nullable: true, type: String })
	observationWindowStartedAt: string | null;
	@ApiPropertyOptional({ nullable: true, type: String })
	observationWindowEndedAt: string | null;
	@ApiPropertyOptional({
		nullable: true,
		enum: Object.values(MACHINE_QUALIFICATION_STATE),
	})
	qualificationState: MachineQualificationState | null;
	@ApiPropertyOptional({ nullable: true, type: String })
	qualificationReason: string | null;
	@ApiProperty({ type: [MachineQualificationCheckDto] })
	qualificationChecks: MachineQualificationCheckDto[];
}

export class MachineReliabilityEventDto {
	@ApiProperty() id: string;
	@ApiProperty() machineId: string;
	@ApiPropertyOptional({ type: String, nullable: true }) jobId: string | null;
	@ApiPropertyOptional({ type: Number, nullable: true }) jobAttempt:
		| number
		| null;
	@ApiPropertyOptional({ type: String, nullable: true }) sandboxId:
		| string
		| null;
	@ApiPropertyOptional({ type: Number, nullable: true }) specGeneration:
		| number
		| null;
	@ApiProperty({ enum: Object.values(MACHINE_FAULT_DOMAIN) })
	faultDomain: MachineFaultDomain;
	@ApiProperty({ enum: Object.values(JOB_LIFECYCLE_PHASE) })
	phase: JobLifecyclePhase;
	@ApiProperty({ enum: Object.values(MACHINE_RELIABILITY_OUTCOME) })
	outcome: MachineReliabilityOutcome;
	@ApiProperty({ enum: Object.values(MACHINE_RELIABILITY_SEVERITY) })
	severity: MachineReliabilitySeverity;
	@ApiProperty() reasonCode: string;
	@ApiProperty() evidenceDigest: string;
	@ApiProperty({ type: 'object', additionalProperties: true })
	evidence: Record<string, string | number | boolean>;
	@ApiProperty({
		enum: Object.values(MACHINE_RELIABILITY_SOURCE),
		enumName: 'MachineReliabilitySource',
		description:
			'Who observed the event: the platform outranks what the machine reports',
	})
	source: MachineReliabilitySource;
	@ApiProperty({
		description:
			"Whether the sandbox belongs to the machine's own host, so the event never counts",
	})
	selfDealt: boolean;
	@ApiProperty() eventKind: string;
	@ApiProperty() observedAt: string;
}

export class MachineReliabilityEventPageDto extends CursorPageDto<MachineReliabilityEventDto> {
	@ApiProperty({ type: [MachineReliabilityEventDto] })
	declare items: MachineReliabilityEventDto[];
}
