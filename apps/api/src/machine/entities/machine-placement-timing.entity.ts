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
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import {
	PLACEMENT_TIMING_KINDS,
	type PlacementTimingKind,
} from '../constants/machine-placement.constants';
import { Machine } from './machine.entity';

const timingKinds = PLACEMENT_TIMING_KINDS.map((kind) => `'${kind}'`).join(
	', '
);

@Entity({ tableName: 'machine_placement_timing' })
@Check({
	name: 'CHK_machine_placement_timing_kind',
	expression: `"kind" in (${timingKinds})`,
})
@Check({
	name: 'CHK_machine_placement_timing_mass',
	expression: `"sampleMass" > '0'::double precision`,
})
export class MachinePlacementTiming {
	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		primary: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_placement_timing_machine',
	})
	machineId: string;

	@PrimaryKey({ type: 'string', columnType: 'varchar' })
	kind: PlacementTimingKind;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'sampleMass',
	})
	sampleMass: number;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'meanLogSeconds',
	})
	meanLogSeconds: number;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'meanSquareLogSeconds',
	})
	meanSquareLogSeconds: number;
}
