/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BadRequestException,
	HttpStatus,
	type MiddlewareConsumer,
	Module,
	type NestModule,
	type OnModuleInit,
} from '@nestjs/common';
import { APP_GUARD, DiscoveryModule, HttpAdapterHost } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AuthModule } from '../auth/auth.module';
import { SnapflowAuthGuard } from '../auth/guards/auth.guard';
import { SystemActionGuard } from '../auth/guards/system-action.guard';
import { VersionHeaderMiddleware } from '../common/middleware/version-header.middleware';
import { HealthModule } from '../health/health.module';
import { IdempotencyKeyGuard } from '../idempotency/guards/idempotency-key.guard';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { MutationPolicyRegistryValidationService } from '../idempotency/services/mutation-policy-registry-validation.service';
import { NotificationGatewayModule } from '../notification/notification-gateway.module';
import { OrganizationModule } from '../organization/organization.module';
import { PublicConfigModule } from '../public-config/public-config.module';
import { MaintenanceGuard } from '../settings/guards/maintenance.guard';
import { SettingsModule } from '../settings/settings.module';

@Module({
	imports: [
		AuthModule,
		HealthModule,
		IdempotencyModule,
		NotificationGatewayModule,
		OrganizationModule,
		PublicConfigModule,
		SettingsModule,
		DiscoveryModule,
	],
	providers: [
		{ provide: APP_GUARD, useClass: SnapflowAuthGuard },
		{ provide: APP_GUARD, useClass: MaintenanceGuard },
		{ provide: APP_GUARD, useClass: SystemActionGuard },
		{ provide: APP_GUARD, useClass: IdempotencyKeyGuard },
		MutationPolicyRegistryValidationService,
	],
})
export class AppHttpModule implements NestModule, OnModuleInit {
	constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

	configure(consumer: MiddlewareConsumer) {
		consumer.apply(VersionHeaderMiddleware).forRoutes('*path');
	}

	// Answers malformed JSON bodies with 400 instead of the generic 500.
	onModuleInit() {
		this.httpAdapterHost.httpAdapter
			.getInstance()
			.use(
				(
					err: Error & { body?: unknown },
					_req: Request,
					res: Response,
					next: NextFunction
				) => {
					if (err instanceof SyntaxError && 'body' in err) {
						const response = new BadRequestException(
							'Invalid JSON in request body'
						).getResponse();
						return res.status(HttpStatus.BAD_REQUEST).json(response);
					}
					next(err);
				}
			);
	}
}
