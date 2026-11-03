/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Entity,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'payout_batch' })
@Unique({ name: 'UQ_payout_batch_iso_week', properties: ['isoWeek'] })
export class PayoutBatch {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({ type: 'string', columnType: 'varchar', fieldName: 'isoWeek' })
	isoWeek: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'startedAt',
	})
	startedAt: Date;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'completedAt',
		nullable: true,
	})
	completedAt: Date | null = null;
}
