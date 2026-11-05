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
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Machine } from '../../machine/entities/machine.entity';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { PlacementLocality } from '../enums/placement-locality.enum';
import { Sandbox } from './sandbox.entity';

@Entity({ tableName: 'sandbox_placement' })
@Index({
	name: 'IDX_sandbox_placement_active',
	expression:
		'create unique index "IDX_sandbox_placement_active" on "sandbox_placement" ("sandboxId") where "releasedAt" is null',
})
@Index({
	name: 'IDX_sandbox_placement_machine_active',
	expression:
		'create index "IDX_sandbox_placement_machine_active" on "sandbox_placement" ("machineId") where "releasedAt" is null',
})
@Index({
	name: 'IDX_sandbox_placement_machine',
	properties: ['machineId', 'placedAt', 'id'],
})
@Index({
	name: 'UQ_sandbox_placement_network_fence',
	expression:
		'create unique index "UQ_sandbox_placement_network_fence" on "sandbox_placement" ("id", "sandboxId", "machineId", "assignmentGeneration")',
})
@Check({
	name: 'CHK_sandbox_placement_locality',
	expression: `"locality" is null or "locality" in (${Object.values(
		PlacementLocality
	)
		.map((locality) => `'${locality}'`)
		.join(', ')})`,
})
@Check({
	name: 'CHK_sandbox_placement_generation',
	expression: '"assignmentGeneration" > 0',
})
@Check({
	name: 'CHK_sandbox_placement_kind',
	expression: `"placementKind" in (${sqlValueList(PlacementKind)})`,
})
export class SandboxPlacement {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_placement_sandbox',
	})
	sandboxId: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_placement_machine',
	})
	machineId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'fencingToken',
	})
	fencingToken: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'placementKind',
	})
	placementKind: PlacementKind;

	@Property({
		type: 'string',
		columnType: 'varchar',
		nullable: true,
	})
	locality: PlacementLocality | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'placedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	placedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'releasedAt',
		nullable: true,
	})
	releasedAt: Date | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'releaseReason',
		nullable: true,
	})
	releaseReason: string | null;
}
