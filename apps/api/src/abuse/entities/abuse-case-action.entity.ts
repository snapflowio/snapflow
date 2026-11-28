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
	createdAtColumn,
	textColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../../infra/database/utils/entity-columns.util';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { User } from '../../user/entities/user.entity';
import { AbuseCaseAction } from '../constants/abuse-report.constants';
import { AbuseCase } from './abuse-case.entity';

@Entity({ tableName: 'abuse_case_action' })
@Index({
	name: 'IDX_abuse_case_action_case',
	properties: ['abuseCaseId', 'createdAt'],
})
@Check({
	name: 'CHK_abuse_case_action_action',
	expression: `"action" in (${sqlValueList(AbuseCaseAction)})`,
})
export class AbuseCaseActionRecord {
	[OptionalProps]?: 'id' | 'createdAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => AbuseCase,
		mapToPk: true,
		joinColumn: 'abuseCaseId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_abuse_case_action_case',
	})
	abuseCaseId: string;

	@Property(varcharColumn('action'))
	action: AbuseCaseAction;

	@ManyToOne({
		entity: () => User,
		mapToPk: true,
		joinColumn: 'actorId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_abuse_case_action_actor',
	})
	actorId: string | null;

	@Property({ ...textColumn('note'), nullable: true })
	note: string | null;

	@Property(createdAtColumn)
	createdAt: Date;
}
