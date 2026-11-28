/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { Machine } from './machine.entity';

const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

@Entity({ tableName: 'machine_health_gap' })
@Index({
	name: 'IDX_machine_health_gap_machine',
	properties: ['machineId', 'endAt'],
})
@Check({
	name: 'CHK_machine_health_gap_order',
	expression: '"endAt" > "startAt"',
})
export class MachineHealthGap {
	[OptionalProps]?: 'id';

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
		foreignKeyName: 'FK_machine_health_gap_machine',
	})
	machineId: string;

	@Property(timestampColumn('startAt'))
	startAt: Date;

	@Property(timestampColumn('endAt'))
	endAt: Date;
}
