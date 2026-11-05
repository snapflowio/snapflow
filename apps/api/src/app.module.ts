/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { BillingUsageModule } from './billing/billing-usage.module';
import { CustomDomainModule } from './custom-domain/custom-domain.module';
import { AppDevelopmentModule } from './development/development.module';
import { DockerRegistryModule } from './docker-registry/docker-registry.module';
import { AppHttpModule } from './http/http.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { InfraModule } from './infra/infra.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { MarketplaceBrowseModule } from './marketplace/marketplace-browse.module';
import { NetworkUsageModule } from './network-usage/network-usage.module';
import { NetworkingModule } from './networking/networking.module';
import { NotificationModule } from './notification/notification.module';
import { NotificationRedisEmitterModule } from './notification/notification-redis-emitter.module';
import { ObjectStorageModule } from './object-storage/object-storage.module';
import { OrganizationModule } from './organization/organization.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { AppSchedulerModule } from './scheduler/scheduler.module';
import { SecretsModule } from './secrets/secrets.module';
import { SettingsModule } from './settings/settings.module';
import { SettlementModule } from './settlement/settlement.module';
import { SettlementMachineModule } from './settlement/settlement-machine.module';
import { UsageModule } from './usage/usage.module';
import { UserModule } from './user/user.module';
import { VerificationModule } from './verification/verification.module';

const FEATURE_MODULES = [
	AuditModule,
	AuthModule,
	BillingModule,
	BillingUsageModule,
	DockerRegistryModule,
	IdempotencyModule,
	MarketplaceModule,
	MarketplaceBrowseModule,
	CustomDomainModule,
	NetworkingModule,
	NetworkUsageModule,
	NotificationModule,
	ObjectStorageModule,
	OrganizationModule,
	AdminModule,
	SandboxModule,
	SecretsModule,
	SettingsModule,
	SettlementModule,
	SettlementMachineModule,
	UsageModule,
	UserModule,
	VerificationModule,
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
