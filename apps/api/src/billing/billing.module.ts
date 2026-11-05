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
import { BillingController } from './controllers/billing.controller';
import { BillingStatementController } from './controllers/billing-statement.controller';
import { BillingBudget } from './entities/billing-budget.entity';
import { BillingBudgetVersion } from './entities/billing-budget-version.entity';
import { BillingEvidenceBundle } from './entities/billing-evidence-bundle.entity';
import { BillingLedgerAccount } from './entities/billing-ledger-account.entity';
import { BillingLedgerEntry } from './entities/billing-ledger-entry.entity';
import { BillingLedgerTransaction } from './entities/billing-ledger-transaction.entity';
import { BillingLineAdjustment } from './entities/billing-line-adjustment.entity';
import { BillingLineItem } from './entities/billing-line-item.entity';
import { BillingLineQuarantine } from './entities/billing-line-quarantine.entity';
import { PlacementBillingAuthorization } from './entities/placement-billing-authorization.entity';
import { BillingBudgetService } from './services/billing-budget.service';
import { BillingConfigService } from './services/billing-config.service';
import { BillingCreditGrantService } from './services/billing-credit-grant.service';
import { BillingLedgerService } from './services/billing-ledger.service';
import { BillingLineAdjustmentService } from './services/billing-line-adjustment.service';
import { BillingLineItemService } from './services/billing-line-item.service';
import { BillingLineQueryService } from './services/billing-line-query.service';
import { BillingOverviewService } from './services/billing-overview.service';
import { BillingRunwayService } from './services/billing-runway.service';
import { BillingStatementService } from './services/billing-statement.service';
import { BillingAttestationService } from './services/evidence/billing-attestation.service';
import { BillingEvidenceAuditorService } from './services/evidence/billing-evidence-auditor.service';
import { BillingEvidenceBundleService } from './services/evidence/billing-evidence-bundle.service';
import { BillingEvidenceRetentionService } from './services/evidence/billing-evidence-retention.service';
import { BillingQuarantineService } from './services/evidence/billing-quarantine.service';
import { PlacementBillingAuthorizationService } from './services/placement/placement-billing-authorization.service';
import { PlacementBillingCapacityService } from './services/placement/placement-billing-capacity.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			BillingBudget,
			BillingBudgetVersion,
			BillingEvidenceBundle,
			BillingLedgerAccount,
			BillingLedgerEntry,
			BillingLedgerTransaction,
			BillingLineAdjustment,
			BillingLineItem,
			BillingLineQuarantine,
			PlacementBillingAuthorization,
		]),
		SettingsModule,
	],
	controllers: [BillingController, BillingStatementController],
	providers: [
		BillingAttestationService,
		BillingBudgetService,
		BillingCreditGrantService,
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
		BillingStatementService,
		PlacementBillingAuthorizationService,
		PlacementBillingCapacityService,
		BillingLedgerService,
	],
	exports: [
		BillingAttestationService,
		BillingCreditGrantService,
		BillingEvidenceBundleService,
		BillingLineAdjustmentService,
		BillingLineItemService,
		BillingOverviewService,
		PlacementBillingAuthorizationService,
		PlacementBillingCapacityService,
		BillingQuarantineService,
		BillingLedgerService,
		BillingEvidenceRetentionService,
	],
})
export class BillingModule {}
