/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit/log/log.module';
import { AuthModule } from '../../auth/auth.module';
import { BillingLedgerModule } from '../../billing/ledger/ledger.module';
import { BillingUsageModule } from '../../billing/usage/usage.module';
import { DockerRegistryModule } from '../../docker-registry/registry/registry.module';
import { IdempotencyRequestModule } from '../../idempotency/request/request.module';
import { InfraModule } from '../../infra/infra.module';
import { MarketplaceBrowseModule } from '../../marketplace/browse/browse.module';
import { MarketplaceMachineModule } from '../../marketplace/machine/machine.module';
import { NetworkingCustomDomainModule } from '../../networking/custom-domain/custom-domain.module';
import { NetworkingRoutingModule } from '../../networking/routing/routing.module';
import { NetworkingUsageModule } from '../../networking/usage/usage.module';
import { NotificationDispatchModule } from '../../notification/dispatch/dispatch.module';
import { NotificationRedisEmitterModule } from '../../notification/redis-emitter/redis-emitter.module';
import { ObjectStorageModule } from '../../object-storage/object-storage.module';
import { OrganizationAdminModule } from '../../organization/admin/admin.module';
import { OrganizationTenantModule } from '../../organization/tenant/tenant.module';
import { PaymentsFundsModule } from '../../payments/funds/funds.module';
import { SandboxInstanceModule } from '../../sandbox/instance/instance.module';
import { SecretsModule } from '../../secrets/secrets.module';
import { SettingsPlatformModule } from '../../settings/platform/platform.module';
import { UsageMeteringModule } from '../../usage/metering/metering.module';
import { UserModule } from '../../user/user.module';
import { VerificationQualificationModule } from '../../verification/qualification/qualification.module';
import { AppDevelopmentModule } from '../development/development.module';
import { AppHttpModule } from '../http/app-http.module';
import { AppSchedulerModule } from '../scheduler/scheduler.module';

const FEATURE_MODULES = [
	AuditLogModule,
	AuthModule,
	BillingLedgerModule,
	BillingUsageModule,
	DockerRegistryModule,
	IdempotencyRequestModule,
	MarketplaceMachineModule,
	MarketplaceBrowseModule,
	NetworkingCustomDomainModule,
	NetworkingRoutingModule,
	NetworkingUsageModule,
	NotificationDispatchModule,
	ObjectStorageModule,
	OrganizationTenantModule,
	OrganizationAdminModule,
	PaymentsFundsModule,
	SandboxInstanceModule,
	SecretsModule,
	SettingsPlatformModule,
	UsageMeteringModule,
	UserModule,
	VerificationQualificationModule,
];

@Module({
	imports: [
		InfraModule,
		...FEATURE_MODULES,
		AppDevelopmentModule,
		AppHttpModule,
	],
})
export class ApiAppModule {}

@Module({
	imports: [
		InfraModule,
		...FEATURE_MODULES,
		AppDevelopmentModule,
		AppSchedulerModule,
		NotificationRedisEmitterModule,
	],
})
export class WorkerAppModule {}

@Module({
	imports: [
		InfraModule,
		...FEATURE_MODULES,
		AppDevelopmentModule,
		AppHttpModule,
		AppSchedulerModule,
	],
})
export class AllAppModule {}

@Module({
	imports: [InfraModule, AuthModule, UserModule],
})
export class CliAppModule {}
