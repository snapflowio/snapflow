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
import { relayerWalletProvider } from '../providers/relayer-wallet.provider';
import { SettlementModule } from '../settlement.module';
import { ClaimRelayerJob } from './jobs/claim-relayer.job';
import { EscrowIndexerJob } from './jobs/escrow-indexer.job';
import { VoucherIssuerJob } from './jobs/voucher-issuer.job';
import { ClaimRelayerService } from './services/claim-relayer.service';
import { EscrowIndexerService } from './services/escrow-indexer.service';
import { VoucherIssuerService } from './services/voucher-issuer.service';

@Module({
	imports: [RedisConnectionModule, SettingsModule, SettlementModule],
	providers: [
		relayerWalletProvider,
		ClaimRelayerJob,
		ClaimRelayerService,
		EscrowIndexerJob,
		EscrowIndexerService,
		VoucherIssuerJob,
		VoucherIssuerService,
	],
})
export class SettlementSchedulerModule {}
