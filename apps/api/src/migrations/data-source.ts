/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { join } from 'node:path';
import {
	type Constructor,
	type EntityClass,
	MetadataStorage,
} from '@mikro-orm/core';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migration, Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { ONE_OFF_DATABASE_POOL_MAX } from '../config/constants/process-role.constants';
import { databaseEnvironment } from '../config/environment/namespaces/database.environment';
import { readEnvironment } from '../config/environment/utils/read-environment.util';
import { createDatabaseConfig } from '../config/factories/infrastructure-config.factory';
import { MikroOrmNamingStrategy } from '../infra/database/config/mikro-orm-naming-strategy.config';

const entityModules = import.meta.glob<Record<string, unknown>>(
	'../**/*.entity.ts',
	{ eager: true }
);
const entities = Object.values(entityModules).flatMap((entityModule) =>
	Object.values(entityModule).filter(
		(exportedValue): exportedValue is EntityClass<object> =>
			typeof exportedValue === 'function' &&
			MetadataStorage.isKnownEntity(exportedValue.name)
	)
);
const migrationModules = import.meta.glob<Record<string, unknown>>(
	'./**/[0-9]*-migration.ts',
	{ eager: true }
);

export const createMigrationFileName = (timestamp: string): string =>
	`${timestamp}-migration`;

export const migrationSnapshotOptions = {
	snapshot: true,
	snapshotOnMigrate: false,
} as const;

export const discoverMigrations = (
	modules: Record<string, Record<string, unknown>>
): Constructor<Migration>[] =>
	Object.values(modules)
		.flatMap((migrationModule) => Object.values(migrationModule))
		.filter(
			(exportedValue): exportedValue is Constructor<Migration> =>
				typeof exportedValue === 'function' &&
				exportedValue.prototype instanceof Migration
		)
		.sort((left, right) => left.name.localeCompare(right.name));

const database = createDatabaseConfig(
	readEnvironment(process.env, [databaseEnvironment]),
	ONE_OFF_DATABASE_POOL_MAX
);

export const baseDataSourceOptions = defineConfig({
	clientUrl: database.url,
	debug: database.logging,
	discovery: { warnWhenNoEntities: false },
	driverOptions: database.driverOptions,
	entities,
	extensions: [Migrator],
	metadataProvider: ReflectMetadataProvider,
	namingStrategy: MikroOrmNamingStrategy,
	pool: {
		idleTimeoutMillis: database.pool.idleTimeoutMillis,
		max: database.pool.max,
		min: database.pool.min,
	},
	multipleStatements: false,
});

export default defineConfig({
	...baseDataSourceOptions,
	migrations: {
		fileName: createMigrationFileName,
		migrationsList: discoverMigrations(migrationModules),
		path: import.meta.dirname,
		pathTs: join(process.cwd(), 'src/migrations'),
		...migrationSnapshotOptions,
		snapshotName: 'snapflow',
	},
});
