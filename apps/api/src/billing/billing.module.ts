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
import { SettingsModule } from '../settings/settings.module';
import { SettlementChainModule } from '../settlement/settlement-chain.module';
import { SettlementSignerModule } from '../settlement/settlement-signer.module';
import { ApiKeyBudgetController } from './controllers/api-key-budget.controller';
import { BillingController } from './controllers/billing.controller';
import { BillingProfileController } from './controllers/billing-profile.controller';
import { BillingReceiptController } from './controllers/billing-receipt.controller';
import { BillingStatementController } from './controllers/billing-statement.controller';
import { ApiKeyBudget } from './entities/api-key-budget.entity';
import { BillingBudget } from './entities/billing-budget.entity';
import { BillingBudgetVersion } from './entities/billing-budget-version.entity';
import { BillingEvidenceBundle } from './entities/billing-evidence-bundle.entity';
import { BillingLedgerAccount } from './entities/billing-ledger-account.entity';
import { BillingLedgerEntry } from './entities/billing-ledger-entry.entity';
import { BillingLedgerTransaction } from './entities/billing-ledger-transaction.entity';
import { BillingLineAdjustment } from './entities/billing-line-adjustment.entity';
import { BillingLineItem } from './entities/billing-line-item.entity';
import { BillingLineQuarantine } from './entities/billing-line-quarantine.entity';
import { BillingProfile } from './entities/billing-profile.entity';
import { BillingReceipt } from './entities/billing-receipt.entity';
import { EarlySessionFailure } from './entities/early-session-failure.entity';
import { OrganizationFunding } from './entities/organization-funding.entity';
import { PlacementBillingAuthorization } from './entities/placement-billing-authorization.entity';
import { StorageCharge } from './entities/storage-charge.entity';
import { ApiKeyBudgetService } from './services/api-key-budget.service';
import { BillingBudgetService } from './services/billing-budget.service';
import { BillingConfigService } from './services/billing-config.service';
import { BillingOverviewService } from './services/billing-overview.service';
import { BillingProfileService } from './services/billing-profile.service';
import { BillingReceiptService } from './services/billing-receipt.service';
import { BillingRunwayService } from './services/billing-runway.service';
import { BillingStatementService } from './services/billing-statement.service';
import { BillingAttestationService } from './services/evidence/billing-attestation.service';
import { BillingEvidenceAuditorService } from './services/evidence/billing-evidence-auditor.service';
import { BillingEvidenceBundleService } from './services/evidence/billing-evidence-bundle.service';
import { BillingEvidenceRetentionService } from './services/evidence/billing-evidence-retention.service';
import { BillingQuarantineService } from './services/evidence/billing-quarantine.service';
import { BillingLedgerService } from './services/ledger/billing-ledger.service';
import { BillingLineAdjustmentService } from './services/line-item/billing-line-adjustment.service';
import { BillingLineItemService } from './services/line-item/billing-line-item.service';
import { BillingLineQueryService } from './services/line-item/billing-line-query.service';
import { PlacementBillingAuthorizationService } from './services/placement/placement-billing-authorization.service';
import { PlacementBillingCapacityService } from './services/placement/placement-billing-capacity.service';
import { StorageBillingService } from './services/storage-billing.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			ApiKeyBudget,
			BillingBudget,
			BillingBudgetVersion,
			BillingEvidenceBundle,
			BillingLedgerAccount,
			BillingLedgerEntry,
			BillingLedgerTransaction,
			BillingLineAdjustment,
			BillingLineItem,
			BillingLineQuarantine,
			EarlySessionFailure,
			BillingProfile,
			BillingReceipt,
			OrganizationFunding,
			PlacementBillingAuthorization,
			StorageCharge,
		]),
		SettingsModule,
		SettlementChainModule,
		SettlementSignerModule,
	],
	controllers: [
		ApiKeyBudgetController,
		BillingController,
		BillingProfileController,
		BillingReceiptController,
		BillingStatementController,
	],
	providers: [
		ApiKeyBudgetService,
		BillingAttestationService,
		BillingBudgetService,
		BillingEvidenceAuditorService,
		BillingEvidenceBundleService,
		BillingEvidenceRetentionService,
		BillingLineAdjustmentService,
		BillingLineItemService,
		BillingLineQueryService,
		BillingConfigService,
		BillingOverviewService,
		BillingQuarantineService,
		BillingRunwayService,
		BillingProfileService,
		BillingReceiptService,
		BillingStatementService,
		PlacementBillingAuthorizationService,
		PlacementBillingCapacityService,
		StorageBillingService,
		BillingLedgerService,
	],
	exports: [
		ApiKeyBudgetService,
		BillingAttestationService,
		BillingEvidenceBundleService,
		BillingLineAdjustmentService,
		BillingLineItemService,
		BillingOverviewService,
		BillingRunwayService,
		PlacementBillingAuthorizationService,
		PlacementBillingCapacityService,
		StorageBillingService,
		BillingQuarantineService,
		BillingLedgerService,
		BillingEvidenceRetentionService,
	],
})
export class BillingModule {}
