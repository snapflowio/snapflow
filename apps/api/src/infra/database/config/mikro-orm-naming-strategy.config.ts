/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { UnderscoreNamingStrategy } from '@mikro-orm/core';

const CONSTRAINT_SUFFIX = {
	foreign: 'fk',
	index: 'index',
	primary: 'pk',
	unique: 'unique',
} as const;

export class MikroOrmNamingStrategy extends UnderscoreNamingStrategy {
	override indexName(
		tableName: string,
		columns: string[],
		type:
			| 'primary'
			| 'foreign'
			| 'unique'
			| 'index'
			| 'sequence'
			| 'check'
			| 'default'
			| 'trigger'
	): string {
		if (type in CONSTRAINT_SUFFIX) {
			return `${tableName}_${columns.join('_')}_${CONSTRAINT_SUFFIX[type as keyof typeof CONSTRAINT_SUFFIX]}`;
		}

		return super.indexName(tableName, columns, type);
	}
}
