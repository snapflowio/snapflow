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
	Unique,
} from '@mikro-orm/decorators/legacy';
import { BILLING_COLUMN_LENGTH } from '../../billing/constants/billing.constants';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Machine } from '../../sandbox/machine/entities/machine.entity';
import { FingerprintKind } from '../enums/fingerprint-kind.enum';

@Entity({ tableName: 'machine_fingerprint_component' })
@Unique({
	name: 'UQ_machine_fingerprint_component',
	properties: ['machineId', 'kind', 'valueDigest'],
})
@Index({
	name: 'IDX_machine_fingerprint_component_value',
	properties: ['kind', 'valueDigest'],
})
@Check({
	name: 'CHK_machine_fingerprint_component_kind',
	expression: `"kind" in (${sqlValueList(FingerprintKind)})`,
})
export class MachineFingerprintComponent {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_fingerprint_component_machine',
	})
	machineId: string;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'kind' })
	kind: FingerprintKind;

	@Property({
		type: 'string',
		columnType: `varchar(${BILLING_COLUMN_LENGTH.EVIDENCE_DIGEST})`,
		fieldName: 'valueDigest',
	})
	valueDigest: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;
}
