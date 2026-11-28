/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AbuseSchedulerModule } from '../abuse/scheduler/scheduler.module';
import { AuditSchedulerModule } from '../audit/scheduler/scheduler.module';
import { AuthModule } from '../auth/auth.module';
import { AuthSchedulerModule } from '../auth/scheduler/scheduler.module';
import { BillingSchedulerModule } from '../billing/scheduler/scheduler.module';
import { AppDevelopmentModule } from '../development/development.module';
import { DockerRegistryModule } from '../docker-registry/docker-registry.module';
import { IdempotencySchedulerModule } from '../idempotency/scheduler/scheduler.module';
import { MarketplaceSchedulerModule } from '../marketplace/scheduler/scheduler.module';
import { NetworkingModule } from '../networking/networking.module';
import { NetworkingSchedulerModule } from '../networking/scheduler/scheduler.module';
import { NotificationSchedulerModule } from '../notification/scheduler/scheduler.module';
import { OrganizationSchedulerModule } from '../organization/scheduler/scheduler.module';
import { RetentionSchedulerModule } from '../retention/scheduler/scheduler.module';
import { SandboxSchedulerModule } from '../sandbox/scheduler/scheduler.module';
import { SettingsSchedulerModule } from '../settings/scheduler/scheduler.module';
import { SettingsModule } from '../settings/settings.module';
import { SettlementSchedulerModule } from '../settlement/scheduler/scheduler.module';
import { UsageSchedulerModule } from '../usage/scheduler/scheduler.module';
import { VerificationSchedulerModule } from '../verification/scheduler/scheduler.module';
import { WebhookSchedulerModule } from '../webhook/scheduler/scheduler.module';
import { SchedulerStartupService } from './services/scheduler-startup.service';

@Module({
	imports: [
		ScheduleModule.forRoot(),
		AppDevelopmentModule,
		AbuseSchedulerModule,
		AuditSchedulerModule,
		AuthModule,
		AuthSchedulerModule,
		BillingSchedulerModule,
		DockerRegistryModule,
		IdempotencySchedulerModule,
		MarketplaceSchedulerModule,
		NetworkingSchedulerModule,
		NotificationSchedulerModule,
		OrganizationSchedulerModule,
		RetentionSchedulerModule,
		SandboxSchedulerModule,
		SettingsSchedulerModule,
		SettlementSchedulerModule,
		UsageSchedulerModule,
		VerificationSchedulerModule,
		WebhookSchedulerModule,
		NetworkingModule,
		SettingsModule,
	],
	providers: [SchedulerStartupService],
})
export class AppSchedulerModule {}
