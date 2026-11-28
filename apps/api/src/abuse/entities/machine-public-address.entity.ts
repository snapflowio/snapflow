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
} from '@mikro-orm/decorators/legacy';
import {
	timestampColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../../infra/database/utils/entity-columns.util';
import { Machine } from '../../machine/entities/machine.entity';

@Entity({ tableName: 'machine_public_address' })
@Index({
	name: 'IDX_machine_public_address_machine',
	properties: ['machineId', 'lastSeenAt'],
})
@Index({
	name: 'IDX_machine_public_address_address',
	properties: ['address', 'lastSeenAt'],
})
export class MachinePublicAddress {
	[OptionalProps]?: 'id';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_public_address_machine',
	})
	machineId: string;

	@Property(varcharColumn('address'))
	address: string;

	@Property(timestampColumn('firstSeenAt'))
	firstSeenAt: Date;

	@Property(timestampColumn('lastSeenAt'))
	lastSeenAt: Date;
}
