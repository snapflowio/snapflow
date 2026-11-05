/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { RedisConnectionModule } from '../../infra/redis/redis.module';
import { SettingsModule } from '../../settings/settings.module';
import { SettlementModule } from '../settlement.module';
import { EscrowIndexerJob } from './jobs/escrow-indexer.job';
import { EscrowIndexerService } from './services/escrow-indexer.service';

@Module({
	imports: [RedisConnectionModule, SettingsModule, SettlementModule],
	providers: [EscrowIndexerJob, EscrowIndexerService],
})
export class SettlementSchedulerModule {}
