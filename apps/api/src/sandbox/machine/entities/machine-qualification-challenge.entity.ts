/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DecimalType } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import {
	BILLING_NUMERIC_PRECISION,
	BILLING_NUMERIC_SCALE,
} from '../../../billing/ledger/constants/billing.constants';
import { SHA256_HEX_LENGTH } from '../../../common/constants/digest.constants';
import { Job } from '../../machine-job/entities/job.entity';
import {
	MACHINE_QUALIFICATION_LIMITS,
	MACHINE_QUALIFICATION_STATE,
	type MachineQualificationState,
} from '../constants/machine-qualification.constants';
import { Machine } from './machine.entity';
import { MachineSession } from './machine-session.entity';

const machineQualificationStates = Object.values(MACHINE_QUALIFICATION_STATE)
	.map((state) => `'${state}'`)
	.join(', ');

@Entity({ tableName: 'machine_qualification_challenge' })
@Index({
	name: 'IDX_machine_qualification_challenge_machine_state',
	properties: ['machineId', 'state', 'completedAt'],
})
@Index({
	name: 'IDX_machine_qualification_challenge_machine_issued',
	properties: ['machineId', 'issuedAt'],
})
@Index({
	name: 'UQ_machine_qualification_challenge_job',
	expression:
		'create unique index "UQ_machine_qualification_challenge_job" on "machine_qualification_challenge" ("jobId") where "jobId" is not null',
})
@Check({
	name: 'CHK_machine_qualification_challenge_versions',
	expression:
		'"schemaVersion" > 0 and "policyVersion" > 0 and "machineSessionGeneration" > 0',
})
@Check({
	name: 'CHK_machine_qualification_challenge_state',
	expression: `"state" in (${machineQualificationStates})`,
})
@Check({
	name: 'CHK_machine_qualification_challenge_expiry',
	expression: '"expiresAt" > "issuedAt"',
})
@Check({
	name: 'CHK_machine_qualification_canary_credit',
	expression: '"canaryCreditMicroUsd" >= 0',
})
export class MachineQualificationChallenge {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_qualification_challenge_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => MachineSession,
		mapToPk: true,
		joinColumn: 'machineSessionId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_qualification_challenge_session',
	})
	machineSessionId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'machineSessionGeneration',
	})
	machineSessionGeneration: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'machineKeyId',
	})
	machineKeyId: string;

	@ManyToOne({
		entity: () => Job,
		mapToPk: true,
		joinColumn: 'jobId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_qualification_challenge_job',
	})
	jobId: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'schemaVersion',
	})
	schemaVersion: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'policyVersion',
	})
	policyVersion: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'qualificationClass',
	})
	qualificationClass: string;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'requestedCheckIds',
	})
	requestedCheckIds: string[];

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'workLimits',
	})
	workLimits: Record<string, number>;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'canarySnapshot',
	})
	canarySnapshot: string;

	@Property({
		type: new DecimalType('string'),
		columnType: `numeric(${BILLING_NUMERIC_PRECISION.MONEY},${BILLING_NUMERIC_SCALE.MONEY})`,
		fieldName: 'canaryCreditMicroUsd',
		default: '0',
	})
	canaryCreditMicroUsd = '0';

	@Property({
		type: 'string',
		columnType: `varchar(${SHA256_HEX_LENGTH})`,
		fieldName: 'nonceDigest',
	})
	nonceDigest: string;

	@Property({
		type: 'string',
		columnType: `varchar(${SHA256_HEX_LENGTH})`,
		fieldName: 'requestDigest',
	})
	requestDigest: string;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_QUALIFICATION_LIMITS.DIGEST_LENGTH})`,
		fieldName: 'inputFingerprint',
	})
	inputFingerprint: string;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_QUALIFICATION_LIMITS.DIGEST_LENGTH})`,
		fieldName: 'releaseDigest',
	})
	releaseDigest: string;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_QUALIFICATION_LIMITS.STATE_LENGTH})`,
	})
	state: MachineQualificationState;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'reasonCode',
		nullable: true,
	})
	reasonCode: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'issuedAt',
	})
	issuedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'expiresAt',
	})
	expiresAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'consumedAt',
		nullable: true,
	})
	consumedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'completedAt',
		nullable: true,
	})
	completedAt: Date | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
