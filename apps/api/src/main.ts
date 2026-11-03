/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import http from 'node:http';
import https from 'node:https';
import { MikroORM } from '@mikro-orm/postgresql';
import { Logger, type Type, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import CacheableLookup from 'cacheable-lookup';
import type { Express } from 'express';
import { LoggerErrorInterceptor, Logger as PinoLogger } from 'nestjs-pino';
import { configureBodyParsers } from './app/http/body-parsers.config';
import { resolveClientIpHeader } from './app/http/client-ip.config';
import { corsOptions } from './app/http/cors-options.config';
import { createOpenApiDocument } from './app/http/openapi.config';
import { AuditInterceptor } from './audit/log/interceptors/audit.interceptor';
import type { Auth } from './auth/better-auth/better-auth.config';
import { BETTER_AUTH } from './auth/better-auth/better-auth.provider';
import { AUTH_BASE_PATH } from './auth/constants/auth-paths.constants';
import { API_GLOBAL_PREFIX } from './common/constants/api-path.constants';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ContentTypeInterceptor } from './common/interceptors/content-type.interceptor';
import { errorMessage } from './common/utils/error/error.util';
import { ProcessRole } from './config/enums/process-role.enum';
import { TypedConfigService } from './config/services/typed-config.service';
import { currentProcess } from './config/utils/current-process.util';
import { assertDatabaseSchemaReady } from './infra/database/utils/database-schema-readiness.util';
import { startTelemetry, stopTelemetry } from './tracing';

const PROCESS_FAILURE_EXIT_CODE = 1;
const AUTH_HANDLER_ROUTE = `${AUTH_BASE_PATH}/*splat`;
const processLogger = new Logger('Process');

const cacheableLookup = new CacheableLookup();
cacheableLookup.install(http.globalAgent);
cacheableLookup.install(https.globalAgent);

const ROOT_MODULES = {
	[ProcessRole.API]: async () =>
		(await import('./app/root/app.module')).ApiAppModule,
	[ProcessRole.WORKER]: async () =>
		(await import('./app/root/app.module')).WorkerAppModule,
	[ProcessRole.ALL]: async () =>
		(await import('./app/root/app.module')).AllAppModule,
} satisfies Record<ProcessRole, () => Promise<Type>>;

export async function bootstrap() {
	startTelemetry();
	const { role, traits } = currentProcess();
	const rootModule = await ROOT_MODULES[role]();
	if (!traits.servesHttp) {
		await bootstrapContext(rootModule);
		return;
	}
	const app = await NestFactory.create<NestExpressApplication>(rootModule, {
		bufferLogs: true,
		bodyParser: false,
		rawBody: true,
		routeConflictPolicy: { duplicate: 'error' },
		routeResolutionStrategy: 'specificity',
	});

	app.useLogger(app.get(PinoLogger));
	app.flushLogs();
	const configService = app.get(TypedConfigService);
	app.enableCors(corsOptions(configService.get('trustedWebOrigins')));
	const server: Express = app.getHttpAdapter().getInstance();
	app.set('trust proxy', configService.get('trustedProxyCidrs'));
	server.use(resolveClientIpHeader);
	server.all(AUTH_HANDLER_ROUTE, toNodeHandler(app.get<Auth>(BETTER_AUTH)));
	configureBodyParsers(app);
	await assertDatabaseSchemaReady(app.get(MikroORM));

	app.set('query parser', 'extended');

	app.useGlobalFilters(new AllExceptionsFilter());
	app.useGlobalInterceptors(new LoggerErrorInterceptor());
	app.useGlobalInterceptors(new ContentTypeInterceptor());
	app.useGlobalInterceptors(app.get(AuditInterceptor));
	app.useGlobalPipes(
		new ValidationPipe({
			forbidNonWhitelisted: true,
			forbidUnknownValues: true,
			transform: true,
			whitelist: true,
		})
	);

	app.setGlobalPrefix(API_GLOBAL_PREFIX);

	SwaggerModule.setup('api', app, () => createOpenApiDocument(app));

	app.enableShutdownHooks();

	const host = '0.0.0.0';
	const port = configService.get('port');

	await app.listen(port, host);
	Logger.log(
		`Snapflow API is running on: http://${host}:${port}/${API_GLOBAL_PREFIX}`
	);
}

async function bootstrapContext(module: Type): Promise<void> {
	const app = await NestFactory.createApplicationContext(module, {
		bufferLogs: true,
	});
	app.useLogger(app.get(PinoLogger));
	app.flushLogs();
	const config = app.get(TypedConfigService);
	await assertDatabaseSchemaReady(app.get(MikroORM));
	app.enableShutdownHooks();
	Logger.log(`Snapflow ${config.get('processRole')} process is running`);
}

function describeError(error: unknown): string {
	return error instanceof Error && error.stack
		? error.stack
		: errorMessage(error);
}

function failFast(kind: string, error: unknown): never {
	processLogger.fatal(`${kind}: ${describeError(error)}`);
	process.exit(PROCESS_FAILURE_EXIT_CODE);
}

process.on('unhandledRejection', (reason: unknown) =>
	failFast('Unhandled promise rejection', reason)
);
process.on('uncaughtException', (error: Error) =>
	failFast('Uncaught exception', error)
);

bootstrap().catch((error: unknown) => failFast('API bootstrap failed', error));

process.once('SIGTERM', () => {
	stopTelemetry().catch((error: unknown) => {
		processLogger.error(
			`OpenTelemetry shutdown failed: ${describeError(error)}`
		);
	});
});
