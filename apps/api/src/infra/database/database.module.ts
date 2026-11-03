/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { join } from 'node:path';
import { Migrator } from '@mikro-orm/migrations';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Global, Module } from '@nestjs/common';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { TypedConfigModule } from '../../config/typed-config.module';
import { ENTITY_MAPPING_OPTIONS } from './config/entity-mapping.config';
import { TransactionCommitHooks } from './subscribers/transaction-commit-hooks.subscriber';

@Global()
@Module({
	imports: [
		MikroOrmModule.forRootAsync({
			driver: PostgreSqlDriver,
			imports: [TypedConfigModule],
			inject: [TypedConfigService],
			useFactory: (configService: TypedConfigService) => ({
				autoLoadEntities: true,
				clientUrl: configService.getOrThrow('database.url'),
				debug: configService.get('database.logging'),
				discovery: { warnWhenNoEntities: false },
				driverOptions: configService.get('database.driverOptions'),
				extensions: [Migrator],
				...ENTITY_MAPPING_OPTIONS,
				migrations: {
					path: join(import.meta.dirname, 'migrations', 'pre-deploy'),
					pathTs: join(process.cwd(), 'apps/api/src/migrations/pre-deploy'),
					snapshot: false,
				},
				pool: {
					idleTimeoutMillis: configService.get(
						'database.pool.idleTimeoutMillis'
					),
					max: configService.get('database.pool.max'),
					min: configService.get('database.pool.min'),
				},
			}),
		}),
	],
	providers: [TransactionCommitHooks],
	exports: [TransactionCommitHooks],
})
export class DatabaseModule {}
