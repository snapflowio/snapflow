/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { JsonObject } from '@bufbuild/protobuf';
import { DecimalType } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { BILLING_COLUMN_LENGTH } from '../../billing/constants/billing.constants';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { MACHINE_USAGE_NUMERIC_PRECISION } from '../../machine/constants/machine-usage.constants';
import { Machine } from '../../machine/entities/machine.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SpotCheckState } from '../enums/spot-check-state.enum';

const nullableTimestampColumn = (fieldName: string) =>
	({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName,
		nullable: true,
	}) as const;

const nullableBytesColumn = (fieldName: string) =>
	({
		type: DecimalType,
		columnType: `numeric(${MACHINE_USAGE_NUMERIC_PRECISION.NETWORK_BYTES},0)`,
		runtimeType: 'string',
		fieldName,
		nullable: true,
	}) as const;

@Entity({ tableName: 'machine_spot_check' })
@Index({
	name: 'IDX_machine_spot_check_schedule',
	properties: ['state', 'scheduledAt'],
})
@Index({
	name: 'IDX_machine_spot_check_machine',
	properties: ['machineId', 'completedAt'],
})
@Check({
	name: 'CHK_machine_spot_check_state',
	expression: `"state" in (${sqlValueList(SpotCheckState)})`,
})
export class MachineSpotCheck {
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
		foreignKeyName: 'FK_machine_spot_check_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_spot_check_sandbox',
	})
	sandboxId: string | null = null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'state',
		default: SpotCheckState.SCHEDULED,
	})
	state: SpotCheckState = SpotCheckState.SCHEDULED;

	@Property({
		type: 'string',
		columnType: `varchar(${BILLING_COLUMN_LENGTH.EVIDENCE_DIGEST})`,
		fieldName: 'nonce',
	})
	nonce: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'scheduledAt',
	})
	scheduledAt: Date;

	@Property(nullableTimestampColumn('startedAt'))
	startedAt: Date | null = null;

	@Property(nullableTimestampColumn('completedAt'))
	completedAt: Date | null = null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'measurements',
		nullable: true,
	})
	measurements: JsonObject | null = null;

	@Property(nullableTimestampColumn('canaryStartedAt'))
	canaryStartedAt: Date | null = null;

	@Property(nullableTimestampColumn('canaryFinishedAt'))
	canaryFinishedAt: Date | null = null;

	@Property(nullableBytesColumn('canaryUploadBytes'))
	canaryUploadBytes: string | null = null;

	@Property(nullableBytesColumn('canaryDownloadBytes'))
	canaryDownloadBytes: string | null = null;

	@Property(nullableBytesColumn('canaryMeasuredEgressBytes'))
	canaryMeasuredEgressBytes: string | null = null;

	@Property(nullableBytesColumn('canaryMeasuredIngressBytes'))
	canaryMeasuredIngressBytes: string | null = null;

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		fieldName: 'failureReasons',
		defaultRaw: `'{}'`,
	})
	failureReasons: string[] = [];
}
