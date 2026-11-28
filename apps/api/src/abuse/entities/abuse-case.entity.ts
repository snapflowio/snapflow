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
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import {
	booleanColumn,
	uuidColumn,
	varcharColumn,
} from '../../infra/database/utils/entity-columns.util';
import { Machine } from '../../machine/entities/machine.entity';
import { User } from '../../user/entities/user.entity';
import { AbuseCaseStatus } from '../constants/abuse.constants';
import type { AbuseFindings } from '../types/abuse-finding.types';

const TIMESTAMP_COLUMN = {
	type: 'datetime',
	columnType: 'timestamptz(3)',
} as const;

const OPTIONAL_TIMESTAMP_COLUMN = {
	...TIMESTAMP_COLUMN,
	nullable: true,
} as const;

@Entity({ tableName: 'abuse_case' })
@Index({
	name: 'UQ_abuse_case_open_sandbox',
	expression: `create unique index "UQ_abuse_case_open_sandbox" on "abuse_case" ("sandboxId") where "status" <> '${AbuseCaseStatus.RESOLVED}'`,
})
@Index({
	name: 'IDX_abuse_case_status_last_seen',
	properties: ['status', 'lastSeenAt', 'id'],
})
@Index({
	name: 'IDX_abuse_case_last_seen',
	properties: ['lastSeenAt', 'id'],
})
@Index({
	name: 'IDX_abuse_case_organization_status',
	properties: ['organizationId', 'status'],
})
@Check({
	name: 'CHK_abuse_case_status',
	expression: `"status" in (${Object.values(AbuseCaseStatus)
		.map((status) => `'${status}'`)
		.join(', ')})`,
})
export class AbuseCase {
	[OptionalProps]?: 'manual';

	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property(varcharColumn('sandboxId'))
	sandboxId: string;

	@Property(uuidColumn('organizationId'))
	organizationId: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_abuse_case_machine',
	})
	machineId: string | null;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'status' })
	status: AbuseCaseStatus = AbuseCaseStatus.OBSERVED;

	@Property({ type: 'json', columnType: 'jsonb', fieldName: 'findings' })
	findings: AbuseFindings = {};

	@Property({ ...TIMESTAMP_COLUMN, fieldName: 'firstSeenAt' })
	firstSeenAt: Date;

	@Property({ ...TIMESTAMP_COLUMN, fieldName: 'lastSeenAt' })
	lastSeenAt: Date;

	@Property({ ...OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'throttledAt' })
	throttledAt: Date | null = null;

	@Property({ ...OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'notifiedAt' })
	notifiedAt: Date | null = null;

	@Property({ ...OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'suspendedAt' })
	suspendedAt: Date | null = null;

	@Property({ ...OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'resolvedAt' })
	resolvedAt: Date | null = null;

	@Property(booleanColumn('manual'))
	manual = false;

	@Property({ ...OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'previewDisabledAt' })
	previewDisabledAt: Date | null = null;

	@Property({ ...OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'egressBlockedAt' })
	egressBlockedAt: Date | null = null;

	@Property({ ...OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'pausedAt' })
	pausedAt: Date | null = null;

	@Property({ ...OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'terminatedAt' })
	terminatedAt: Date | null = null;

	@Property({
		...OPTIONAL_TIMESTAMP_COLUMN,
		fieldName: 'organizationSuspendedAt',
	})
	organizationSuspendedAt: Date | null = null;

	@Property({ ...OPTIONAL_TIMESTAMP_COLUMN, fieldName: 'referredAt' })
	referredAt: Date | null = null;

	@ManyToOne({
		entity: () => User,
		mapToPk: true,
		joinColumn: 'resolvedBy',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_abuse_case_resolved_by',
	})
	resolvedBy: string | null = null;
}
