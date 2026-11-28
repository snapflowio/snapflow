/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DynamicModule, Global, Module } from '@nestjs/common';
import {
	ConfigModuleOptions,
	ConfigModule as NestConfigModule,
} from '@nestjs/config';
import { loadConfiguration } from './configuration.config';
import { TypedConfigService } from './services/typed-config.service';

@Global()
@Module({
	providers: [TypedConfigService],
	exports: [TypedConfigService],
})
export class TypedConfigModule {
	static forRoot(options: ConfigModuleOptions = {}): DynamicModule {
		return {
			module: TypedConfigModule,
			imports: [
				NestConfigModule.forRoot({
					...options,
					isGlobal: true,
					cache: true,
					ignoreEnvFile: true,
					skipProcessEnv: true,
					load: [loadConfiguration],
				}),
			],
		};
	}
}
