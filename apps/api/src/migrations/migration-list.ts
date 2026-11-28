/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Constructor } from '@mikro-orm/core';
import { Migration } from '@mikro-orm/migrations';

const migrationModules = import.meta.glob<Record<string, unknown>>(
	'./[0-9]*-migration.ts',
	{ eager: true }
);

export const MIGRATIONS: Constructor<Migration>[] = Object.values(
	migrationModules
)
	.flatMap((migrationModule) => Object.values(migrationModule))
	.filter(
		(exportedValue): exportedValue is Constructor<Migration> =>
			typeof exportedValue === 'function' &&
			exportedValue.prototype instanceof Migration
	)
	.sort((left, right) => left.name.localeCompare(right.name));
