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
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import {
	timestampColumn,
	uuidPrimaryKey,
} from '../../infra/database/utils/entity-columns.util';
import { Machine } from '../../machine/entities/machine.entity';

@Entity({ tableName: 'machine_connection_coverage' })
@Unique({
	name: 'UQ_machine_connection_coverage_bucket',
	properties: ['machineId', 'bucketStart'],
})
@Index({
	name: 'IDX_machine_connection_coverage_bucket',
	properties: ['bucketStart'],
})
export class MachineConnectionCoverage {
	[OptionalProps]?: 'id' | 'overflowWorkloadIds';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_connection_coverage_machine',
	})
	machineId: string;

	@Property(timestampColumn('bucketStart'))
	bucketStart: Date;

	@Property({
		type: 'string',
		columnType: 'tstzmultirange',
		fieldName: 'covered',
		defaultRaw: "'{}'::tstzmultirange",
	})
	covered: string;

	@Property({
		type: 'string[]',
		columnType: 'text[]',
		fieldName: 'overflowWorkloadIds',
		defaultRaw: `'{}'`,
	})
	overflowWorkloadIds: string[] = [];
}
