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
import { BillingModule } from '../billing/billing.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { SETTLEMENT_PUBLIC_CLIENT } from './constants/settlement.constants';
import { EscrowController } from './controllers/escrow.controller';
import { PaymentWalletController } from './controllers/payment-wallet.controller';
import { EscrowAccount } from './entities/escrow-account.entity';
import { EscrowEvent } from './entities/escrow-event.entity';
import { EscrowSessionKey } from './entities/escrow-session-key.entity';
import { PaymentWallet } from './entities/payment-wallet.entity';
import { SettlementChainCursor } from './entities/settlement-chain-cursor.entity';
import { chainClientProvider } from './providers/chain-client.provider';
import { EscrowAccountService } from './services/escrow-account.service';
import { EscrowAttributionService } from './services/escrow-attribution.service';
import { EscrowIngestionService } from './services/escrow-ingestion.service';
import { EscrowLedgerService } from './services/escrow-ledger.service';
import { EscrowProjectionService } from './services/escrow-projection.service';
import { PaymentWalletService } from './services/payment-wallet.service';
import { PayoutReadinessService } from './services/payout-readiness.service';
import { SanctionsScreeningService } from './services/sanctions-screening.service';
import { WalletChallengeService } from './services/wallet-challenge.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			EscrowAccount,
			EscrowEvent,
			EscrowSessionKey,
			PaymentWallet,
			SettlementChainCursor,
		]),
		AuthModule,
		BillingModule,
		RedisConnectionModule,
	],
	controllers: [EscrowController, PaymentWalletController],
	providers: [
		chainClientProvider,
		EscrowAccountService,
		EscrowAttributionService,
		EscrowIngestionService,
		EscrowLedgerService,
		EscrowProjectionService,
		PaymentWalletService,
		PayoutReadinessService,
		SanctionsScreeningService,
		WalletChallengeService,
	],
	exports: [
		SETTLEMENT_PUBLIC_CLIENT,
		EscrowIngestionService,
		PaymentWalletService,
		PayoutReadinessService,
	],
})
export class SettlementModule {}
