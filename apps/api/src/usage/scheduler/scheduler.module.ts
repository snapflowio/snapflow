/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { UsageModule } from '../usage.module';
import { UsageArchiveJob } from './jobs/usage-archive.job';
import { UsageDriftReconcilerJob } from './jobs/usage-drift-reconciler.job';
import { UsageWindowRotationJob } from './jobs/usage-window-rotation.job';

@Module({
	imports: [UsageModule],
	providers: [UsageArchiveJob, UsageDriftReconcilerJob, UsageWindowRotationJob],
})
export class UsageSchedulerModule {}
