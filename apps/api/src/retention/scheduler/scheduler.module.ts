/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { DataRetentionService } from '../services/data-retention.service';
import { DataRetentionJob } from './jobs/data-retention.job';

@Module({
	providers: [DataRetentionService, DataRetentionJob],
})
export class RetentionSchedulerModule {}
