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
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Continent } from '../../location/enums/continent.enum';

@Entity({ tableName: 'unmet_demand' })
@Unique({
	name: 'UQ_unmet_demand_deduplication',
	properties: ['deduplicationKey'],
})
@Index({
	name: 'IDX_unmet_demand_recent',
	properties: ['createdAt', 'priceClass'],
})
export class UnmetDemand {
	[OptionalProps]?: 'id' | 'createdAt';

	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'deduplicationKey',
	})
	deduplicationKey: string;

	@Property({ type: 'uuid', columnType: 'uuid', fieldName: 'organizationId' })
	organizationId: string;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'priceClass' })
	priceClass: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'continent',
		nullable: true,
	})
	continent: Continent | null;

	@Property({ type: 'double', columnType: 'double precision' })
	cpu: number;

	@Property({
		type: 'double',
		columnType: 'double precision',
		fieldName: 'memoryGiB',
	})
	memoryGiB: number;

	@Property({ type: 'integer', columnType: 'integer' })
	gpu: number;

	@Property({
		type: 'boolean',
		columnType: 'boolean',
		fieldName: 'wholeMachine',
	})
	wholeMachine: boolean;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
	})
	createdAt: Date;
}
