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
import { RedisConnectionModule } from '../../infra/redis/redis.module';
import { SandboxBillableUsage } from './entities/sandbox-billable-usage.entity';
import { SandboxUsagePeriod } from './entities/sandbox-usage-period.entity';
import { SandboxUsagePeriodArchive } from './entities/sandbox-usage-period-archive.entity';
import { UsageArchiveService } from './services/usage-archive.service';
import { UsageDriftReconcilerService } from './services/usage-drift-reconciler.service';
import { UsageLifecycleService } from './services/usage-lifecycle.service';
import { UsageLockService } from './services/usage-lock.service';
import { UsagePeriodService } from './services/usage-period.service';
import { UsageWindowRotationService } from './services/usage-window-rotation.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			SandboxUsagePeriod,
			SandboxUsagePeriodArchive,
			SandboxBillableUsage,
		]),
		RedisConnectionModule,
	],
	providers: [
		UsageLockService,
		UsagePeriodService,
		UsageLifecycleService,
		UsageDriftReconcilerService,
		UsageWindowRotationService,
		UsageArchiveService,
	],
	exports: [
		UsageArchiveService,
		UsageDriftReconcilerService,
		UsageWindowRotationService,
	],
})
export class UsageMeteringModule {}
