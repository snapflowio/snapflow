/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { SETTLEMENT_PUBLIC_CLIENT } from './constants/settlement.constants';
import { chainClientProvider } from './providers/chain-client.provider';
import { SettlementAlertService } from './services/alerts/settlement-alert.service';
import { ChainIdentityCheckService } from './services/chain/chain-identity-check.service';
import { ChainClockService } from './services/escrow/chain-clock.service';
import { EscrowLogReaderService } from './services/escrow/escrow-log-reader.service';
import { SafeWalletChainService } from './services/wallets/safe-wallet-chain.service';

@Module({
	imports: [RedisConnectionModule],
	providers: [
		chainClientProvider,
		ChainClockService,
		EscrowLogReaderService,
		SafeWalletChainService,
		SettlementAlertService,
		ChainIdentityCheckService,
	],
	exports: [
		SETTLEMENT_PUBLIC_CLIENT,
		ChainClockService,
		ChainIdentityCheckService,
		EscrowLogReaderService,
		SafeWalletChainService,
		SettlementAlertService,
	],
})
export class SettlementChainModule {}
