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
import { SandboxRuntimeState } from '@snapflow/machine-proto';
import { Machine } from '../machine/entities/machine.entity';
import { protoEnumCheckExpression } from '../machine/utils/proto/proto-enum.util';
import { Sandbox } from './sandbox.entity';

@Entity({ tableName: 'sandbox_observed_status' })
@Check({
	name: 'CHK_sandbox_observed_status_state',
	expression: protoEnumCheckExpression('state', SandboxRuntimeState, false),
})
@Check({
	name: 'CHK_sandbox_observed_status_generations',
	expression: '"assignmentGeneration" > 0 and "observedSpecGeneration" >= 0',
})
export class SandboxObservedStatus {
	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		primary: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_observed_status_sandbox',
	})
	sandboxId: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_sandbox_observed_status_machine',
	})
	machineId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'observedSpecGeneration',
	})
	observedSpecGeneration: number;

	@Property({
		type: 'smallint',
		columnType: 'smallint',
	})
	state: SandboxRuntimeState;

	@Property({
		type: 'string',
		columnType: 'text',
		fieldName: 'errorReason',
		nullable: true,
	})
	errorReason: string | null;

	@Property({
		type: 'boolean',
		default: false,
	})
	recoverable: boolean;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'daemonVersion',
		nullable: true,
	})
	daemonVersion: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'observedAt',
	})
	observedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'receivedAt',
	})
	receivedAt: Date;
}
