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
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import {
	MACHINE_ATTRIBUTION_SUBJECT,
	MACHINE_RELIABILITY_LIMITS,
	MACHINE_WORKLOAD_OUTCOME_CLASS,
	type MachineAttributionSubject,
	type MachineWorkloadOutcomeClass,
} from '../constants/machine-reliability.constants';

function sqlValues(values: Record<string, string>): string {
	return Object.values(values)
		.map((value) => `'${value}'`)
		.join(', ');
}

@Entity({ tableName: 'machine_workload_outcome' })
@Index({
	name: 'IDX_machine_workload_outcome_observed',
	properties: ['lastObservedAt'],
})
@Check({
	name: 'CHK_machine_workload_outcome_class',
	expression: `"outcomeClass" in (${sqlValues(MACHINE_WORKLOAD_OUTCOME_CLASS)})`,
})
@Check({
	name: 'CHK_machine_workload_outcome_subject',
	expression: `"subjectKind" in (${sqlValues(MACHINE_ATTRIBUTION_SUBJECT)})`,
})
export class MachineWorkloadOutcome {
	@PrimaryKey({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.OUTCOME})`,
		fieldName: 'subjectKind',
	})
	subjectKind: MachineAttributionSubject;

	@PrimaryKey({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.WORKLOAD_FINGERPRINT})`,
	})
	subject: string;

	@PrimaryKey({ type: 'string', columnType: 'varchar' })
	host: string;

	@PrimaryKey({
		type: 'string',
		columnType: `varchar(${MACHINE_RELIABILITY_LIMITS.OUTCOME})`,
		fieldName: 'outcomeClass',
	})
	outcomeClass: MachineWorkloadOutcomeClass;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastObservedAt',
	})
	lastObservedAt: Date;
}
