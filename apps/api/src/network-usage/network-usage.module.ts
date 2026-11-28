/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { SandboxModule } from '../sandbox/sandbox.module';
import { SettingsModule } from '../settings/settings.module';
import { NetworkUsageController } from './controllers/network-usage.controller';
import { ExposureNetworkUsage } from './entities/exposure-network-usage.entity';
import { NetworkUsagePeriod } from './entities/network-usage-period.entity';
import { NetworkUsageService } from './services/network-usage.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([ExposureNetworkUsage, NetworkUsagePeriod]),
		BillingModule,
		RedisConnectionModule,
		SandboxModule,
		SettingsModule,
	],
	controllers: [NetworkUsageController],
	providers: [NetworkUsageService],
	exports: [NetworkUsageService],
})
export class NetworkUsageModule {}
