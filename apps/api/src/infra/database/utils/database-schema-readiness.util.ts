/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MikroORM } from '@mikro-orm/postgresql';

const MIGRATION_COMMAND = 'pnpm migration:run:pre-deploy';

export async function assertDatabaseSchemaReady(orm: MikroORM): Promise<void> {
	await orm.connect();
	const pendingMigrations = await orm.migrator.getPending();
	if (pendingMigrations.length > 0) {
		throw new Error(
			`Database schema has ${pendingMigrations.length} pending migration(s); run ${MIGRATION_COMMAND} before starting the API`
		);
	}
}
