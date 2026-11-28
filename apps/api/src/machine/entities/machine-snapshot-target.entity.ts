/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Entity,
	Enum,
	Index,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { MachineSnapshotTargetReason } from '../enums/machine-snapshot-target-reason.enum';
import type { SnapshotTemplatePreparation } from '../utils/proto/snapshot-template.util';

@Entity({ tableName: 'machine_snapshot_target' })
@Unique({
	name: 'machine_snapshot_target_unique',
	properties: ['machineId', 'snapshotRef', 'reason'],
})
@Index({
	name: 'IDX_machine_snapshot_target_snapshot',
	properties: ['snapshotRef', 'reason', 'createdAt'],
})
export class MachineSnapshotTarget {
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
		items: () => MachineSnapshotTargetReason,
		nativeEnumName: 'machine_snapshot_target_reason_enum',
	})
	reason: MachineSnapshotTargetReason;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		nullable: true,
	})
	template: SnapshotTemplatePreparation | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
