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
import { Job } from '../../machine-job/entities/job.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import {
	type JobLifecyclePhase,
	MACHINE_FAULT_DOMAIN,
	MACHINE_RELIABILITY_LIMITS,
	MACHINE_RELIABILITY_OUTCOME,
	MACHINE_RELIABILITY_SEVERITY,
	MACHINE_RELIABILITY_SOURCE,
	type MachineFaultDomain,
	type MachineReliabilityOutcome,
	type MachineReliabilitySeverity,
	type MachineReliabilitySource,
} from '../constants/machine-reliability.constants';
import { Machine } from './machine.entity';
import { MachineSession } from './machine-session.entity';

function sqlValues(values: Record<string, string>): string {
	return Object.values(values)
		.map((value) => `'${value}'`)
		.join(', ');
}

@Entity({ tableName: 'machine_reliability_event' })
@Index({
	name: 'UQ_machine_reliability_event_deduplication',
	expression:
		'create unique index "UQ_machine_reliability_event_deduplication" on "machine_reliability_event" ("deduplicationKey")',
})
@Index({
	name: 'IDX_machine_reliability_event_machine_observed',
	expression:
		'create index "IDX_machine_reliability_event_machine_observed" on "machine_reliability_event" ("machineId", "observedAt", "id") include ("outcome", "source", "selfDealt", "workloadFingerprint", "customerOrganizationId", "placementId")',
})
@Index({
	name: 'IDX_machine_reliability_event_placement_outcome',
	properties: ['placementId', 'outcome', 'observedAt'],
})
@Index({
	name: 'IDX_machine_reliability_event_machine_workload',
	expression:
		'create index "IDX_machine_reliability_event_machine_workload" on "machine_reliability_event" ("machineId", "workloadFingerprint", "observedAt") include ("outcome")',
})
@Index({
	name: 'IDX_machine_reliability_event_observed',
	properties: ['observedAt'],
})
@Check({
	name: 'CHK_machine_reliability_event_subject',
	expression:
		'("jobId" is not null and "jobAttempt" > 0 and "specGeneration" is null) or ("jobId" is null and "jobAttempt" is null and "specGeneration" >= 0)',
})
@Check({
	name: 'CHK_machine_reliability_event_outcome',
	expression: `"outcome" in (${sqlValues(MACHINE_RELIABILITY_OUTCOME)})`,
})
@Check({
	name: 'CHK_machine_reliability_event_severity',
	expression: `"severity" in (${sqlValues(MACHINE_RELIABILITY_SEVERITY)})`,
})
@Check({
	name: 'CHK_machine_reliability_event_fault_domain',
	expression: `"faultDomain" in (${sqlValues(MACHINE_FAULT_DOMAIN)})`,
})
@Check({
	name: 'CHK_machine_reliability_event_source',
	expression: `"source" in (${sqlValues(MACHINE_RELIABILITY_SOURCE)})`,
})
export class MachineReliabilityEvent {
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
		foreignKeyName: 'FK_machine_reliability_event_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumn: 'placementId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_reliability_event_placement',
	})
	placementId: string | null;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_reliability_event_sandbox',
	})
	sandboxId: string | null;

	@ManyToOne({
		entity: () => Job,
		mapToPk: true,
		joinColumn: 'jobId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_reliability_event_job',
		nullable: true,
	})
	jobId: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'jobAttempt',
		nullable: true,
	})
	jobAttempt: number | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'specGeneration',
		nullable: true,
	})
	specGeneration: number | null;

	@ManyToOne({
		entity: () => MachineSession,
		mapToPk: true,
		joinColumn: 'machineSessionId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_reliability_event_session',
	})
	machineSessionId: string | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
		nullable: true,
	})
	assignmentGeneration: number | null;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.WORKLOAD_FINGERPRINT})`,
		fieldName: 'workloadFingerprint',
		nullable: true,
	})
	workloadFingerprint: string | null;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.EVENT_KIND})`,
		fieldName: 'eventKind',
	})
	eventKind: string;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.SOURCE})`,
	})
	source: MachineReliabilitySource;

	@Property({
		type: 'boolean',
		columnType: 'boolean',
		fieldName: 'selfDealt',
		default: false,
	})
	selfDealt: boolean;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'customerOrganizationId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_reliability_event_customer_organization',
	})
	customerOrganizationId: string | null;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.PHASE})`,
	})
	phase: JobLifecyclePhase;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.OUTCOME})`,
	})
	outcome: MachineReliabilityOutcome;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.SEVERITY})`,
	})
	severity: MachineReliabilitySeverity;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.ERROR_CODE})`,
		fieldName: 'reasonCode',
	})
	reasonCode: string;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.FAULT_DOMAIN})`,
		fieldName: 'faultDomain',
	})
	faultDomain: MachineFaultDomain;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.DEDUPLICATION_KEY})`,
		fieldName: 'deduplicationKey',
	})
	deduplicationKey: string;

	@Property({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.EVIDENCE_DIGEST})`,
		fieldName: 'evidenceDigest',
	})
	evidenceDigest: string;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		defaultRaw: "'{}'::jsonb",
	})
	evidence: Record<string, string | number | boolean> = {};

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'observedAt',
	})
	observedAt: Date;
}
