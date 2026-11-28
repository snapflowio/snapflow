/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { BillingModule } from '../../billing/billing.module';
import { RedisConnectionModule } from '../../infra/redis/redis.module';
import { SettingsModule } from '../../settings/settings.module';
import { relayerWalletProvider } from '../providers/relayer-wallet.provider';
import { SettlementModule } from '../settlement.module';
import { EscrowIndexerJob } from './jobs/escrow-indexer.job';
import { EscrowReconciliationJob } from './jobs/escrow-reconciliation.job';
import { PlatformServiceBillerJob } from './jobs/platform-service-biller.job';
import { SanctionsListSyncJob } from './jobs/sanctions-list-sync.job';
import { SettlementOperatorJob } from './jobs/settlement-operator.job';
import { VoucherIssuerJob } from './jobs/voucher-issuer.job';
import { AutoTopUpKeeperService } from './services/auto-top-up/auto-top-up-keeper.service';
import { EscrowCircuitBreakerService } from './services/escrow/escrow-circuit-breaker.service';
import { EscrowIndexerService } from './services/escrow/escrow-indexer.service';
import { EscrowReconciliationService } from './services/escrow/escrow-reconciliation.service';
import { EscrowWriterService } from './services/escrow/escrow-writer.service';
import { OperatorTransactionService } from './services/operator/operator-transaction.service';
import { RelayerHealthService } from './services/operator/relayer-health.service';
import { RelayerRepricingService } from './services/operator/relayer-repricing.service';
import { SettlementOperatorService } from './services/operator/settlement-operator.service';
import { PlatformServiceBillerService } from './services/platform/platform-service-biller.service';
import { SanctionsAlertDeliveryService } from './services/sanctions/sanctions-alert-delivery.service';
import { SanctionsListStoreService } from './services/sanctions/sanctions-list-store.service';
import { SanctionsListSyncService } from './services/sanctions/sanctions-list-sync.service';
import { DeadlineClaimService } from './services/settlements/deadline-claim.service';
import { HostSettlementRelayerService } from './services/settlements/host-settlement-relayer.service';
import { PlatformSettlementService } from './services/settlements/platform-settlement.service';
import { VoucherIssuerService } from './services/vouchers/voucher-issuer.service';
import { WalletRelayerService } from './services/wallets/wallet-relayer.service';

@Module({
	imports: [
		BillingModule,
		RedisConnectionModule,
		SettingsModule,
		SettlementModule,
	],
	providers: [
		relayerWalletProvider,
		AutoTopUpKeeperService,
		DeadlineClaimService,
		EscrowCircuitBreakerService,
		EscrowIndexerJob,
		EscrowIndexerService,
		EscrowReconciliationJob,
		EscrowReconciliationService,
		EscrowWriterService,
		HostSettlementRelayerService,
		OperatorTransactionService,
		PlatformServiceBillerJob,
		PlatformServiceBillerService,
		PlatformSettlementService,
		RelayerHealthService,
		RelayerRepricingService,
		SanctionsAlertDeliveryService,
		SanctionsListStoreService,
		SanctionsListSyncJob,
		SanctionsListSyncService,
		SettlementOperatorJob,
		SettlementOperatorService,
		VoucherIssuerJob,
		VoucherIssuerService,
		WalletRelayerService,
	],
})
export class SettlementSchedulerModule {}
