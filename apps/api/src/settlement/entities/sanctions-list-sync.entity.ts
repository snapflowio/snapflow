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
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { SANCTIONS_LIST_SYNC_ID } from '../constants/sanctions.constants';
import {
	integerColumn,
	timestampColumn,
} from '../utils/settlement-columns.util';

@Entity({ tableName: 'sanctions_list_sync' })
@Check({
	name: 'CHK_sanctions_list_sync_single_row',
	expression: `"id" = ${SANCTIONS_LIST_SYNC_ID}`,
})
export class SanctionsListSync {
	[OptionalProps]?: 'id';

	@PrimaryKey({ type: 'integer', columnType: 'smallint', autoincrement: false })
	id: number = SANCTIONS_LIST_SYNC_ID;

	@Property(timestampColumn('publishedAt'))
	publishedAt: Date;

	@Property(integerColumn('recordCount'))
	recordCount: number;

	@Property(integerColumn('addressCount'))
	addressCount: number;

	@Property(timestampColumn('syncedAt'))
	syncedAt: Date;
}
