/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { join } from 'node:path';
import { type EntityClass, MetadataStorage } from '@mikro-orm/core';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { ONE_OFF_DATABASE_POOL_MAX } from '../config/constants/process-role.constants';
import { databaseEnvironment } from '../config/environment/namespaces/database.environment';
import { readEnvironment } from '../config/environment/utils/read-environment.util';
import { createDatabaseConfig } from '../config/factories/infrastructure-config.factory';
import { MikroOrmNamingStrategy } from '../infra/database/config/mikro-orm-naming-strategy.config';
import { MIGRATIONS } from './migration-list';

const entityModules = import.meta.glob<Record<string, unknown>>(
	'../**/*.{entity,embeddable}.ts',
	{ eager: true }
);
const entities = Object.values(entityModules).flatMap((entityModule) =>
	Object.values(entityModule).filter(
		(exportedValue): exportedValue is EntityClass<object> =>
			typeof exportedValue === 'function' &&
			MetadataStorage.isKnownEntity(exportedValue.name)
	)
);
const database = createDatabaseConfig(
	readEnvironment(process.env, [databaseEnvironment]),
	ONE_OFF_DATABASE_POOL_MAX
);

export default defineConfig({
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
	migrations: {
		fileName: (timestamp: string) => `${timestamp}-migration`,
		migrationsList: MIGRATIONS,
		path: import.meta.dirname,
		pathTs: join(process.cwd(), 'src/migrations'),
		snapshot: true,
		snapshotOnMigrate: false,
		snapshotName: 'snapflow',
	},
});
