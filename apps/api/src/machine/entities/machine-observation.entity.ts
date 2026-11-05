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
	Property,
} from '@mikro-orm/decorators/legacy';
import { Machine } from './machine.entity';
import { MachineSession } from './machine-session.entity';

@Entity({ tableName: 'machine_observation' })
@Check({
	name: 'CHK_machine_observation_generation',
	expression: '"generation" > 0',
})
export class MachineObservation {
	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		primary: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_observation_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => MachineSession,
		mapToPk: true,
		joinColumn: 'sessionId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_observation_session',
	})
	sessionId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
	})
	generation: number;

	@Property({
		type: 'number',
		columnType: 'double precision',
	})
	cpu: number;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'memoryGiB',
	})
	memoryGiB: number;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'diskGiB',
	})
	diskGiB: number;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'observedAt',
	})
	observedAt: Date;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'uptimeOnlineSeconds',
		default: 0,
	})
	uptimeOnlineSeconds = 0;

	@Property({
		type: 'number',
		columnType: 'double precision',
		fieldName: 'uptimeObservedSeconds',
		default: 0,
	})
	uptimeObservedSeconds = 0;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}
