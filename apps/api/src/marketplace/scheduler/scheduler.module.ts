/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { MarketplaceModule } from '../marketplace.module';
import { IdleMachineNoticeService } from '../services/idle-machine-notice.service';
import { IdleMachineNoticeJob } from './jobs/idle-machine-notice.job';

@Module({
	imports: [MarketplaceModule],
	providers: [IdleMachineNoticeService, IdleMachineNoticeJob],
})
export class MarketplaceSchedulerModule {}
