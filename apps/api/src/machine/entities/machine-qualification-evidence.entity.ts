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
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { SHA256_HEX_LENGTH } from '../../common/constants/digest.constants';
import {
	MACHINE_QUALIFICATION_LIMITS,
	MACHINE_QUALIFICATION_VERDICT,
	type MachineQualificationVerdict,
} from '../constants/machine-qualification.constants';
import type { MachineQualificationEvidencePayload } from '../schemas/machine-qualification.schema';
import { MachineQualificationChallenge } from './machine-qualification-challenge.entity';

const machineQualificationVerdicts = Object.values(
	MACHINE_QUALIFICATION_VERDICT
)
	.map((verdict) => `'${verdict}'`)
	.join(', ');

@Entity({ tableName: 'machine_qualification_evidence' })
@Index({
	name: 'UQ_machine_qualification_evidence_challenge',
	expression:
		'create unique index "UQ_machine_qualification_evidence_challenge" on "machine_qualification_evidence" ("challengeId")',
})
@Index({
	name: 'UQ_machine_qualification_evidence_digest',
	expression:
		'create unique index "UQ_machine_qualification_evidence_digest" on "machine_qualification_evidence" ("payloadDigest")',
})
@Check({
	name: 'CHK_machine_qualification_evidence_verdict',
	expression: `"verdict" in (${machineQualificationVerdicts})`,
})
@Check({
	name: 'CHK_machine_qualification_evidence_policy',
	expression: '"evaluatorPolicyVersion" > 0',
})
export class MachineQualificationEvidence {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => MachineQualificationChallenge,
		mapToPk: true,
		joinColumn: 'challengeId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_qualification_evidence_challenge',
	})
	challengeId: string;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'canonicalPayload',
	})
	canonicalPayload: Record<string, unknown>;

	@Property({
		type: 'string',
		columnType: `varchar(${SHA256_HEX_LENGTH})`,
		fieldName: 'payloadDigest',
	})
	payloadDigest: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	signature: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'signingKeyId',
	})
	signingKeyId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'releaseDigest',
	})
	releaseDigest: string;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_QUALIFICATION_LIMITS.DIGEST_LENGTH})`,
		fieldName: 'environmentFingerprint',
	})
	environmentFingerprint: string;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'checkResults',
	})
	checkResults: MachineQualificationEvidencePayload['checkResults'];

	@Property({
		type: 'json',
		columnType: 'jsonb',
	})
	metrics: Record<string, number>;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_QUALIFICATION_LIMITS.VERDICT_LENGTH})`,
	})
	verdict: MachineQualificationVerdict;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'reasonCodes',
	})
	reasonCodes: string[];

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'evaluatorPolicyVersion',
	})
	evaluatorPolicyVersion: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'receivedAt',
	})
	receivedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'appraisedAt',
	})
	appraisedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
