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
import { Sandbox } from '../../sandbox/instance/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/instance/entities/sandbox-placement.entity';
import { Machine } from '../../sandbox/machine/entities/machine.entity';
import { MachineSession } from '../../sandbox/machine/entities/machine-session.entity';
import {
	SECRET_DELIVERY_OUTCOME,
	SECRET_LIMITS,
	type SecretDeliveryOutcome,
} from '../constants/secret.constants';

const secretDeliveryOutcomes = Object.values(SECRET_DELIVERY_OUTCOME)
	.map((value) => `'${value}'`)
	.join(', ');

@Entity({ tableName: 'secret_delivery_event' })
@Index({
	name: 'UQ_secret_delivery_attempt',
	expression:
		'create unique index "UQ_secret_delivery_attempt" on "secret_delivery_event" ("placementId", "specGeneration", "machineSessionId", "secretVersionId", "environmentName")',
})
@Index({
	name: 'IDX_secret_delivery_event_organization_created',
	properties: ['organizationId', 'createdAt'],
})
@Check({
	name: 'CHK_secret_delivery_event_outcome',
	expression: `"outcome" in (${secretDeliveryOutcomes})`,
})
export class SecretDeliveryEvent {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'organizationId',
	})
	organizationId: string;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'secretVersionId',
	})
	secretVersionId: string;

	@ManyToOne({
		entity: () => Sandbox,
		mapToPk: true,
		joinColumn: 'sandboxId',
		columnType: 'varchar',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_secret_delivery_event_sandbox',
	})
	sandboxId: string;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumn: 'placementId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_secret_delivery_event_placement',
	})
	placementId: string;

	@ManyToOne({
		entity: () => MachineSession,
		mapToPk: true,
		joinColumn: 'machineSessionId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_secret_delivery_event_session',
	})
	machineSessionId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'specGeneration',
	})
	specGeneration: number;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_secret_delivery_event_machine',
	})
	machineId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@Property({
		type: 'string',
		columnType: `varchar(${SECRET_LIMITS.ENVIRONMENT_NAME_MAX_LENGTH})`,
		fieldName: 'environmentName',
	})
	environmentName: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
	})
	outcome: SecretDeliveryOutcome;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
