/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { JsonObject } from '@bufbuild/protobuf';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { BILLING_COLUMN_LENGTH } from '../../../billing/ledger/constants/billing.constants';
import { sqlValueList } from '../../../infra/database/utils/sql-value-list.util';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { BenchmarkState } from '../enums/benchmark-state.enum';
import { BenchmarkTrigger } from '../enums/benchmark-trigger.enum';

const integerColumn = (fieldName: string) =>
	({ type: 'integer', columnType: 'integer', fieldName }) as const;

const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

const digestColumn = (fieldName: string) =>
	({
		type: 'string',
		columnType: `varchar(${BILLING_COLUMN_LENGTH.EVIDENCE_DIGEST})`,
		fieldName,
	}) as const;

@Entity({ tableName: 'machine_benchmark' })
@Index({
	name: 'IDX_machine_benchmark_machine',
	properties: ['machineId', 'issuedAt'],
})
@Unique({
	name: 'UQ_machine_benchmark_pending',
	properties: ['machineId'],
	where: `"state" = '${BenchmarkState.PENDING}'`,
})
@Check({
	name: 'CHK_machine_benchmark_trigger',
	expression: `"trigger" in (${sqlValueList(BenchmarkTrigger)})`,
})
@Check({
	name: 'CHK_machine_benchmark_state',
	expression: `"state" in (${sqlValueList(BenchmarkState)})`,
})
@Check({
	name: 'CHK_machine_benchmark_window',
	expression: '"expiresAt" > "issuedAt"',
})
@Check({
	name: 'CHK_machine_benchmark_shape',
	expression:
		'"suiteVersion" > 0 and "cpu" > 0 and "memoryGib" > 0 and "diskGib" > 0 and "gpu" >= 0',
})
export class MachineBenchmark {
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
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_benchmark_machine',
	})
	machineId: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'jobId',
		nullable: true,
	})
	jobId: string | null = null;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'trigger' })
	trigger: BenchmarkTrigger;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'state',
		default: BenchmarkState.PENDING,
	})
	state: BenchmarkState = BenchmarkState.PENDING;

	@Property(integerColumn('suiteVersion'))
	suiteVersion: number;

	@Property(digestColumn('nonce'))
	nonce: string;

	@Property(integerColumn('cpu'))
	cpu: number;

	@Property(integerColumn('memoryGib'))
	memoryGib: number;

	@Property(integerColumn('diskGib'))
	diskGib: number;

	@Property(integerColumn('gpu'))
	gpu: number;

	@Property(timestampColumn('issuedAt'))
	issuedAt: Date;

	@Property(timestampColumn('expiresAt'))
	expiresAt: Date;

	@Property({ ...timestampColumn('completedAt'), nullable: true })
	completedAt: Date | null = null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'measurements',
		nullable: true,
	})
	measurements: JsonObject | null = null;

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		fieldName: 'failureReasons',
		defaultRaw: `'{}'`,
	})
	failureReasons: string[] = [];

	@Property({ ...digestColumn('evidenceDigest'), nullable: true })
	evidenceDigest: string | null = null;
}
