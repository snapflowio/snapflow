/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { TypedConfigModule } from '../../config/typed-config.module';
import {
	getPinoRedaction,
	getPinoTransport,
	swapMessageAndObject,
} from './utils/pino.util';

@Module({
	imports: [
		LoggerModule.forRootAsync({
			imports: [TypedConfigModule],
			providers: [],
			useFactory: (configService: TypedConfigService) => {
				const logConfig = configService.get('log');
				return {
					forRoutes: [{ path: '*path', method: RequestMethod.ALL }],
					pinoHttp: {
						autoLogging: logConfig.requests.enabled,
						level: logConfig.level,
						redact: getPinoRedaction(),
						hooks: {
							logMethod: swapMessageAndObject,
						},
						quietReqLogger: true,
						transport: getPinoTransport(logConfig),
					},
				};
			},
			inject: [TypedConfigService],
		}),
	],
})
export class LoggingModule {}
