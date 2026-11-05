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
import { AuthModule } from '../auth/auth.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { PaymentWalletController } from './controllers/payment-wallet.controller';
import { PaymentWallet } from './entities/payment-wallet.entity';
import { chainClientProvider } from './providers/chain-client.provider';
import { PaymentWalletService } from './services/payment-wallet.service';
import { PayoutReadinessService } from './services/payout-readiness.service';
import { SanctionsScreeningService } from './services/sanctions-screening.service';
import { WalletChallengeService } from './services/wallet-challenge.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([PaymentWallet]),
		AuthModule,
		RedisConnectionModule,
	],
	controllers: [PaymentWalletController],
	providers: [
		chainClientProvider,
		PaymentWalletService,
		PayoutReadinessService,
		SanctionsScreeningService,
		WalletChallengeService,
	],
	exports: [PaymentWalletService, PayoutReadinessService],
})
export class SettlementModule {}
