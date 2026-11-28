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
import type { Address } from 'viem';
import {
	addressColumn,
	createdAtColumn,
	timestampColumn,
	uuidPrimaryKey,
} from '../../settlement/utils/settlement-columns.util';
import { Machine } from './machine.entity';

@Entity({ tableName: 'machine_host_key' })
@Unique({ name: 'UQ_machine_host_key_address', properties: ['address'] })
@Unique({
	name: 'UQ_machine_host_key_current',
	properties: ['machineId'],
	where: '"retiredAt" IS NULL',
})
@Index({ name: 'IDX_machine_host_key_machine', properties: ['machineId'] })
export class MachineHostKey {
	[OptionalProps]?: 'id' | 'createdAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_host_key_machine',
	})
	machineId: string;

	@Property(addressColumn('address'))
	address: Address;

	@Property(timestampColumn('registeredAt'))
	registeredAt: Date;

	@Property({ ...timestampColumn('retiredAt'), nullable: true })
	retiredAt: Date | null;

	@Property(createdAtColumn)
	createdAt: Date;
}
