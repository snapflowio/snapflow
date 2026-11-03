/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { join } from 'node:path';
import { defineConfig } from '@mikro-orm/postgresql';
import {
	baseDataSourceOptions,
	createMigrationFileName,
	discoverMigrations,
	migrationSnapshotOptions,
} from '../data-source';

const migrationModules = import.meta.glob<Record<string, unknown>>(
	'./[0-9]*-migration.ts',
	{ eager: true }
);

export default defineConfig({
	...baseDataSourceOptions,
	migrations: {
		fileName: createMigrationFileName,
		migrationsList: discoverMigrations(migrationModules),
		path: import.meta.dirname,
		pathTs: join(process.cwd(), 'src/migrations/post-deploy'),
		...migrationSnapshotOptions,
		snapshotName: 'snapflow-post-deploy',
	},
});
