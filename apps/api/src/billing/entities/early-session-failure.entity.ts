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
import { Machine } from '../../machine/entities/machine.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';

const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

@Entity({ tableName: 'early_session_failure' })
@Unique({
	name: 'UQ_early_session_failure_session',
	properties: ['placementId', 'assignmentGeneration', 'sessionStartedAt'],
})
@Index({
	name: 'IDX_early_session_failure_machine',
	properties: ['machineId', 'detectedAt'],
})
export class EarlySessionFailure {
	[OptionalProps]?: 'id' | 'detectedAt';

	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => SandboxPlacement,
		mapToPk: true,
		joinColumn: 'placementId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_early_session_failure_placement',
	})
	placementId: string;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'sandboxId' })
	sandboxId: string;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'assignmentGeneration',
	})
	assignmentGeneration: number;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_early_session_failure_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'customerOrganizationId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_early_session_failure_customer',
	})
	customerOrganizationId: string;

	@Property(timestampColumn('sessionStartedAt'))
	sessionStartedAt: Date;

	@Property(timestampColumn('lastHealthyAt'))
	lastHealthyAt: Date;

	@Property({
		...timestampColumn('detectedAt'),
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	detectedAt: Date;
}
