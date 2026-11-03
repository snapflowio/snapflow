/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { AuthModule } from '../../auth/auth.module';
import { SnapflowAuthGuard } from '../../auth/guards/auth.guard';
import { SystemActionGuard } from '../../auth/guards/system-action.guard';
import { VersionHeaderMiddleware } from '../../common/middleware/version-header.middleware';
import { HealthModule } from '../../health/health.module';
import { IdempotencyKeyGuard } from '../../idempotency/request/guards/idempotency-key.guard';
import { IdempotencyRequestModule } from '../../idempotency/request/request.module';
import { NotificationGatewayModule } from '../../notification/gateway/gateway.module';
import { OrganizationTenantModule } from '../../organization/tenant/tenant.module';
import { PublicConfigModule } from '../../public-config/public-config.module';
import { MaintenanceGuard } from '../../settings/platform/guards/maintenance.guard';
import { SettingsPlatformModule } from '../../settings/platform/platform.module';
import { BodyParserErrorModule } from '../body-parser-error/body-parser-error.module';
import { MutationPolicyRegistryValidationService } from './services/mutation-policy-registry-validation.service';

@Module({
	imports: [
		BodyParserErrorModule,
		AuthModule,
		HealthModule,
		IdempotencyRequestModule,
		NotificationGatewayModule,
		OrganizationTenantModule,
		PublicConfigModule,
		SettingsPlatformModule,
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
export class AppHttpModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(VersionHeaderMiddleware).forRoutes('*path');
	}
}
