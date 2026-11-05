/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Check,
	Entity,
	ManyToOne,
	Property,
} from '@mikro-orm/decorators/legacy';
import {
	MACHINE_TRUST_LIMITS,
	MachineRestrictionReason,
	MachineTrustStage,
	type MachineRestrictionReason as RestrictionReason,
	type MachineTrustStage as TrustStage,
} from '../../../billing/constants/machine-trust.constants';
import { BASIS_POINTS_SCALE } from '../../../common/constants/money.constants';
import { SLOW_START_INITIAL_WINDOW } from '../constants/machine-placement.constants';
import { Machine } from './machine.entity';

const machineTrustStages = Object.values(MachineTrustStage)
	.map((stage) => `'${stage}'`)
	.join(', ');
const machineRestrictionReasons = Object.values(MachineRestrictionReason)
	.map((reason) => `'${reason}'`)
	.join(', ');

@Entity({ tableName: 'machine_assessment' })
@Check({
	name: 'CHK_machine_assessment_reliability',
	expression: `"reliabilityBasisPoints" >= 0 and "reliabilityBasisPoints" <= ${BASIS_POINTS_SCALE}`,
})
@Check({
	name: 'CHK_machine_assessment_trust_stage',
	expression: `"trustStage" in (${machineTrustStages})`,
})
@Check({
	name: 'CHK_machine_assessment_sample_counts',
	expression:
		'"successfulSamples" >= 0 and "machineAttributableFailures" >= 0 and "unattributedFailureCount" >= 0 and "neutralEventCount" >= 0 and "quarantinedLineCount" >= 0 and "reconciledWindowCount" >= 0 and "relapseCount" >= 0 and "platformObservedEventCount" >= 0',
})
@Check({
	name: 'CHK_machine_assessment_placement_evidence',
	expression: `"successMass" >= '0'::double precision and "failureMass" >= '0'::double precision and "placementWindow" >= ${SLOW_START_INITIAL_WINDOW}`,
})
@Check({
	name: 'CHK_machine_assessment_attestation',
	expression: `"attestationBasisPoints" >= 0 and "attestationBasisPoints" <= ${BASIS_POINTS_SCALE}`,
})
@Check({
	name: 'CHK_machine_assessment_uptime',
	expression: `"uptimeBasisPoints" >= 0 and "uptimeBasisPoints" <= ${BASIS_POINTS_SCALE}`,
})
@Check({
	name: 'CHK_machine_assessment_health',
	expression: `"healthBasisPoints" >= 0 and "healthBasisPoints" <= ${BASIS_POINTS_SCALE}`,
})
@Check({
	name: 'CHK_machine_assessment_restriction_reason',
	expression: `"restrictionReason" is null or "restrictionReason" in (${machineRestrictionReasons})`,
})
export class MachineAssessment {
	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		primary: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_assessment_machine',
	})
	machineId: string;

	@Property({
		type: 'boolean',
		default: false,
	})
	qualified: boolean;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'reliabilityBasisPoints',
		default: 0,
	})
	reliabilityBasisPoints: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'historicalSampleSize',
		default: 0,
	})
	historicalSampleSize: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'successfulSamples',
		default: 0,
	})
	successfulSamples: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'machineAttributableFailures',
		default: 0,
	})
	machineAttributableFailures: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'unattributedFailureCount',
		default: 0,
	})
	unattributedFailureCount: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'neutralEventCount',
		default: 0,
	})
	neutralEventCount: number;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'successMass',
		default: 0,
	})
	successMass: number;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'failureMass',
		default: 0,
	})
	failureMass: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'placementWindow',
		default: SLOW_START_INITIAL_WINDOW,
	})
	placementWindow: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'attestationBasisPoints',
		default: BASIS_POINTS_SCALE,
	})
	attestationBasisPoints: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'reconciledWindowCount',
		default: 0,
	})
	reconciledWindowCount: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'quarantinedLineCount',
		default: 0,
	})
	quarantinedLineCount: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'uptimeBasisPoints',
		default: BASIS_POINTS_SCALE,
	})
	uptimeBasisPoints: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'platformObservedEventCount',
		default: 0,
	})
	platformObservedEventCount: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'healthBasisPoints',
		default: BASIS_POINTS_SCALE,
	})
	healthBasisPoints: number;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_TRUST_LIMITS.RESTRICTION_REASON})`,
		fieldName: 'restrictionReason',
		nullable: true,
	})
	restrictionReason: RestrictionReason | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'restrictedUntil',
		nullable: true,
	})
	restrictedUntil: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'probationEndsAt',
		nullable: true,
	})
	probationEndsAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'evidenceSince',
		nullable: true,
	})
	evidenceSince: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'releasedAt',
		nullable: true,
	})
	releasedAt: Date | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'relapseCount',
		default: 0,
	})
	relapseCount: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'qualificationExpiresAt',
		nullable: true,
	})
	qualificationExpiresAt: Date | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'qualificationPolicyVersion',
		nullable: true,
	})
	qualificationPolicyVersion: number | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'observationWindowStartedAt',
		nullable: true,
	})
	observationWindowStartedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'observationWindowEndedAt',
		nullable: true,
	})
	observationWindowEndedAt: Date | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'trustStage',
		default: MachineTrustStage.PROBATIONARY,
	})
	trustStage: TrustStage;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'policyVersion',
		default: 1,
	})
	policyVersion: number;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'qualificationReasons',
		defaultRaw: "'[]'::jsonb",
	})
	qualificationReasons: string[];

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'assessedAt',
	})
	assessedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}
