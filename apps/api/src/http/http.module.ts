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
import { CommonErrorCode } from '../common/enums/common-error-code.enum';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { VersionHeaderMiddleware } from '../common/middleware/version-header.middleware';
import { commonApiError } from '../common/utils/error/api-error.util';
import {
	apiErrorBody,
	normalizeErrorResponse,
} from '../common/utils/error/http-exception-response.util';
import { HealthModule } from '../health/health.module';
import { IdempotencyKeyGuard } from '../idempotency/guards/idempotency-key.guard';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { MutationPolicyRegistryValidationService } from '../idempotency/services/mutation-policy-registry-validation.service';
import { TermsAcceptanceGuard } from '../legal/guards/terms-acceptance.guard';
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
		{ provide: APP_GUARD, useClass: RateLimitGuard },
		{ provide: APP_GUARD, useClass: MaintenanceGuard },
		{ provide: APP_GUARD, useClass: SystemActionGuard },
		{ provide: APP_GUARD, useClass: TermsAcceptanceGuard },
		{ provide: APP_GUARD, useClass: IdempotencyKeyGuard },
		MutationPolicyRegistryValidationService,
	],
})
export class AppHttpModule implements NestModule, OnModuleInit {
	constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

	configure(consumer: MiddlewareConsumer) {
		consumer.apply(VersionHeaderMiddleware).forRoutes('*path');
	}

	onModuleInit() {
		this.httpAdapterHost.httpAdapter
			.getInstance()
			.use(
				(
					err: Error & { body?: unknown },
					req: Request,
					res: Response,
					next: NextFunction
				) => {
					if (err instanceof SyntaxError && 'body' in err) {
						const exception = new BadRequestException(
							commonApiError(CommonErrorCode.INVALID_JSON)
						);
						const statusCode = exception.getStatus();
						return res
							.status(statusCode)
							.json(
								apiErrorBody(
									req.originalUrl,
									statusCode,
									normalizeErrorResponse(
										exception.getResponse(),
										exception.message,
										statusCode
									)
								)
							);
					}
					next(err);
				}
			);
	}
}
