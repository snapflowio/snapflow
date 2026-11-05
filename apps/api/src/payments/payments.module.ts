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
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ControlWakeModule } from '../infra/control-wake/control-wake.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { OrganizationModule } from '../organization/organization.module';
import { SettingsModule } from '../settings/settings.module';
import { STRIPE_CLIENT } from './constants/stripe.constants';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { AutoTopUpController } from './controllers/auto-top-up.controller';
import { BillingStatementController } from './controllers/billing-statement.controller';
import { PaymentMethodController } from './controllers/payment-method.controller';
import { PayoutController } from './controllers/payout.controller';
import { StripeWebhookController } from './controllers/stripe-webhook.controller';
import { TopUpController } from './controllers/top-up.controller';
import { AutoTopUpPolicy } from './entities/auto-top-up-policy.entity';
import { PaymentAccount } from './entities/payment-account.entity';
import { PaymentDispute } from './entities/payment-dispute.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { Payout } from './entities/payout.entity';
import { PayoutBatch } from './entities/payout-batch.entity';
import { StripeEvent } from './entities/stripe-event.entity';
import { TopUp } from './entities/top-up.entity';
import { stripeClientProvider } from './providers/stripe-client.provider';
import { stripeEventHandlerProviders } from './providers/stripe-event-handlers.provider';
import { AdminPaymentService } from './services/admin-payment.service';
import { AutoTopUpService } from './services/auto-top-up.service';
import { AutoTopUpChargeService } from './services/auto-top-up-charge.service';
import { AutoTopUpTaxService } from './services/auto-top-up-tax.service';
import { BillingStatementService } from './services/billing-statement.service';
import { EarningsMaturityService } from './services/earnings-maturity.service';
import { PaymentAccountService } from './services/payment-account.service';
import { PaymentMethodService } from './services/payment-method.service';
import { PaymentSuspensionService } from './services/payment-suspension.service';
import { PaymentVelocityService } from './services/payment-velocity.service';
import { PayoutService } from './services/payout.service';
import { StripeAccountEventService } from './services/stripe-event/stripe-account-event.service';
import { StripeDisputeEventService } from './services/stripe-event/stripe-dispute-event.service';
import { StripeEventInboxService } from './services/stripe-event/stripe-event-inbox.service';
import { StripeEventProcessorService } from './services/stripe-event/stripe-event-processor.service';
import { StripePaymentEventService } from './services/stripe-event/stripe-payment-event.service';
import { StripePayoutEventService } from './services/stripe-event/stripe-payout-event.service';
import { StripeRefundEventService } from './services/stripe-event/stripe-refund-event.service';
import { StripeTransferEventService } from './services/stripe-event/stripe-transfer-event.service';
import { StripeReconciliationService } from './services/stripe-reconciliation.service';
import { TopUpService } from './services/top-up.service';
import { TopUpSettlementService } from './services/top-up-settlement.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			AutoTopUpPolicy,
			PaymentAccount,
			PaymentDispute,
			PaymentMethod,
			Payout,
			PayoutBatch,
			StripeEvent,
			TopUp,
		]),
		AuditModule,
		BillingModule,
		ControlWakeModule,
		IdempotencyModule,
		MarketplaceModule,
		OrganizationModule,
		SettingsModule,
	],
	controllers: [
		AdminPaymentController,
		AutoTopUpController,
		BillingStatementController,
		PaymentMethodController,
		PayoutController,
		StripeWebhookController,
		TopUpController,
	],
	providers: [
		stripeClientProvider,
		...stripeEventHandlerProviders,
		AdminPaymentService,
		AutoTopUpService,
		AutoTopUpChargeService,
		AutoTopUpTaxService,
		BillingStatementService,
		EarningsMaturityService,
		PaymentAccountService,
		PaymentMethodService,
		PaymentSuspensionService,
		PaymentVelocityService,
		PayoutService,
		StripeAccountEventService,
		StripeDisputeEventService,
		StripeEventInboxService,
		StripeEventProcessorService,
		StripePaymentEventService,
		StripePayoutEventService,
		StripeRefundEventService,
		StripeReconciliationService,
		StripeTransferEventService,
		TopUpService,
		TopUpSettlementService,
	],
	exports: [
		AutoTopUpChargeService,
		EarningsMaturityService,
		PaymentAccountService,
		PayoutService,
		STRIPE_CLIENT,
		StripeEventProcessorService,
		StripeReconciliationService,
		TopUpSettlementService,
	],
})
export class PaymentsModule {}
