/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BigIntType } from '@mikro-orm/core';
import {
	Entity,
	Enum,
	Index,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { SandboxCapability } from '../../sandbox/enums/sandbox-capability.enum';
import { SnapshotMachineState } from '../enums/snapshot-machine-state.enum';

export interface PreparedSnapshotTemplate {
	key: string;
	cpuQuota: number;
	memoryQuota: number;
	storageQuota: number;
	capabilities: SandboxCapability[];
}

@Entity({ tableName: 'snapshot_machine' })
@Unique({
	name: 'snapshot_machine_machineid_snapshotref_unique',
	properties: ['machineId', 'snapshotRef'],
})
@Index({
	name: 'IDX_snapshot_machine_snapshot_state',
	properties: ['snapshotRef', 'state'],
})
export class SnapshotMachine {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'machineId',
	})
	machineId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'snapshotRef',
	})
	snapshotRef: string;

	@Enum({
		items: () => SnapshotMachineState,
		nativeEnumName: 'snapshot_machine_state_enum',
	})
	state: SnapshotMachineState;

	@Property({
		type: 'string',
		columnType: 'varchar',
		nullable: true,
	})
	digest: string | null;

	@Property({
		type: new BigIntType('number'),
		columnType: 'bigint',
		fieldName: 'sizeBytes',
		default: 0,
	})
	sizeBytes: number;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'errorReason',
		nullable: true,
	})
	errorReason: string | null;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'preparedTemplate',
		nullable: true,
	})
	preparedTemplate: PreparedSnapshotTemplate | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'observedAt',
	})
	observedAt: Date;
}
