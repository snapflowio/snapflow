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
import { ControlWakeModule } from '../infra/control-wake/control-wake.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { LocationModule } from '../location/location.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminPaymentChannelRefundController } from './controllers/admin-payment-channel-refund.controller';
import { ChainRpcController } from './controllers/chain-rpc.controller';
import { EscrowController } from './controllers/escrow.controller';
import { PaymentChannelController } from './controllers/payment-channel.controller';
import { PaymentWalletController } from './controllers/payment-wallet.controller';
import { UserWalletController } from './controllers/user-wallet.controller';
import { VoucherDelegationController } from './controllers/voucher-delegation.controller';
import { AutoTopUp } from './entities/auto-top-up.entity';
import { ClaimAttempt } from './entities/claim-attempt.entity';
import { DelegatedSigner } from './entities/delegated-signer.entity';
import { EscrowAccount } from './entities/escrow-account.entity';
import { EscrowAutoTopUp } from './entities/escrow-auto-top-up.entity';
import { EscrowClaimsFreeze } from './entities/escrow-claims-freeze.entity';
import { EscrowEvent } from './entities/escrow-event.entity';
import { EscrowSigner } from './entities/escrow-signer.entity';
import { HostSettlement } from './entities/host-settlement.entity';
import { PaymentChannel } from './entities/payment-channel.entity';
import { PaymentChannelCharge } from './entities/payment-channel-charge.entity';
import { PaymentChannelRefund } from './entities/payment-channel-refund.entity';
import { PaymentVoucher } from './entities/payment-voucher.entity';
import { PaymentWallet } from './entities/payment-wallet.entity';
import { SanctionedAddress } from './entities/sanctioned-address.entity';
import { SanctionsListSync } from './entities/sanctions-list-sync.entity';
import { SanctionsPendingAlert } from './entities/sanctions-pending-alert.entity';
import { SettlementChainCursor } from './entities/settlement-chain-cursor.entity';
import { SettlementTransaction } from './entities/settlement-transaction.entity';
import { SignatureAudit } from './entities/signature-audit.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { AutoTopUpService } from './services/auto-top-up/auto-top-up.service';
import { ChainRpcProxyService } from './services/chain/chain-rpc-proxy.service';
import { PaymentChannelService } from './services/channels/payment-channel.service';
import { PaymentChannelReadService } from './services/channels/payment-channel-read.service';
import { PaymentChannelRefundService } from './services/channels/payment-channel-refund.service';
import { DelegatedSignerService } from './services/delegated-signer/delegated-signer.service';
import { DelegatedSignerKeyService } from './services/delegated-signer/delegated-signer-key.service';
import { EscrowAccountService } from './services/escrow/escrow-account.service';
import { EscrowAttributionService } from './services/escrow/escrow-attribution.service';
import { EscrowIngestionService } from './services/escrow/escrow-ingestion.service';
import { EscrowLedgerService } from './services/escrow/escrow-ledger.service';
import { EscrowPendingService } from './services/escrow/escrow-pending.service';
import { EscrowPolicyService } from './services/escrow/escrow-policy.service';
import { EscrowProjectionService } from './services/escrow/escrow-projection.service';
import { HostEarningsService } from './services/payouts/host-earnings.service';
import { HostPayoutHistoryService } from './services/payouts/host-payout-history.service';
import { PayoutReadinessService } from './services/payouts/payout-readiness.service';
import { RelayFeeQuoteService } from './services/relay/relay-fee-quote.service';
import { SettlementPartyAccessService } from './services/settlement-party-access.service';
import { SettlementWakeService } from './services/settlement-wake.service';
import { HostSettlementService } from './services/settlements/host-settlement.service';
import { HostSettlementChainService } from './services/settlements/host-settlement-chain.service';
import { HostSettlementOutcomeService } from './services/settlements/host-settlement-outcome.service';
import { VoucherDelegationService } from './services/vouchers/voucher-delegation.service';
import { VoucherIssuanceService } from './services/vouchers/voucher-issuance.service';
import { VoucherSubmissionService } from './services/vouchers/voucher-submission.service';
import { PaymentWalletService } from './services/wallets/payment-wallet.service';
import { SanctionsScreeningService } from './services/wallets/sanctions-screening.service';
import { SiweLinkService } from './services/wallets/siwe-link.service';
import { UserWalletService } from './services/wallets/user-wallet.service';
import { WalletFeeService } from './services/wallets/wallet-fee.service';
import { WalletRecoveryService } from './services/wallets/wallet-recovery.service';
import { WalletTransactionService } from './services/wallets/wallet-transaction.service';
import { WalletTransactionOutcomeService } from './services/wallets/wallet-transaction-outcome.service';
import { SettlementChainModule } from './settlement-chain.module';
import { SettlementSignerModule } from './settlement-signer.module';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			AutoTopUp,
			ClaimAttempt,
			DelegatedSigner,
			EscrowAccount,
			EscrowAutoTopUp,
			EscrowClaimsFreeze,
			EscrowEvent,
			EscrowSigner,
			HostSettlement,
			PaymentChannel,
			PaymentChannelCharge,
			PaymentChannelRefund,
			PaymentVoucher,
			PaymentWallet,
			SanctionedAddress,
			SanctionsListSync,
			SanctionsPendingAlert,
			SettlementChainCursor,
			SettlementTransaction,
			SignatureAudit,
			UserWallet,
			WalletTransaction,
		]),
		AuthModule,
		BillingModule,
		ControlWakeModule,
		LocationModule,
		RedisConnectionModule,
		SettingsModule,
		SettlementChainModule,
		SettlementSignerModule,
	],
	controllers: [
		AdminPaymentChannelRefundController,
		ChainRpcController,
		EscrowController,
		PaymentChannelController,
		PaymentWalletController,
		UserWalletController,
		VoucherDelegationController,
	],
	providers: [
		AutoTopUpService,
		ChainRpcProxyService,
		DelegatedSignerKeyService,
		DelegatedSignerService,
		EscrowAccountService,
		EscrowAttributionService,
		EscrowIngestionService,
		EscrowLedgerService,
		EscrowPendingService,
		EscrowPolicyService,
		EscrowProjectionService,
		HostEarningsService,
		HostPayoutHistoryService,
		HostSettlementChainService,
		HostSettlementOutcomeService,
		HostSettlementService,
		PaymentChannelReadService,
		PaymentChannelRefundService,
		PaymentChannelService,
		PaymentWalletService,
		PayoutReadinessService,
		RelayFeeQuoteService,
		SanctionsScreeningService,
		SettlementPartyAccessService,
		SettlementWakeService,
		SiweLinkService,
		UserWalletService,
		VoucherDelegationService,
		VoucherIssuanceService,
		VoucherSubmissionService,
		WalletFeeService,
		WalletRecoveryService,
		WalletTransactionOutcomeService,
		WalletTransactionService,
	],
	exports: [
		SettlementChainModule,
		SettlementSignerModule,
		EscrowAttributionService,
		EscrowIngestionService,
		EscrowPolicyService,
		HostSettlementChainService,
		HostSettlementOutcomeService,
		HostSettlementService,
		PaymentChannelService,
		PaymentWalletService,
		SanctionsScreeningService,
		SettlementWakeService,
		PayoutReadinessService,
		RelayFeeQuoteService,
		VoucherIssuanceService,
		WalletFeeService,
		WalletTransactionOutcomeService,
		WalletTransactionService,
	],
})
export class SettlementModule {}
