/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import {
	BILLING_LEDGER_PLATFORM_OWNER,
	BillingAdjustmentReasonCode,
	BillingEvidenceStatus,
} from '../../constants/billing.constants';
import type { BillingEvidenceBundle } from '../../entities/billing-evidence-bundle.entity';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import type { PricedLease } from '../../queries/lease-price.query';
import {
	type AttestedCharge,
	attestationReason,
} from '../../utils/evidence/billing-attestation.util';
import { usagePosting } from '../../utils/ledger/billing-usage-posting.util';
import { BillingLedgerService } from '../billing-ledger.service';
import { BillingLineAdjustmentService } from '../billing-line-adjustment.service';
import { BillingEvidenceAuditorService } from './billing-evidence-auditor.service';
import { BillingQuarantineService } from './billing-quarantine.service';

const ATTESTATION_SHORTFALL_EXPLANATION =
	'Signed usage evidence attests less usage than this line was charged for, so the unattested remainder was not charged.';

@Injectable()
export class BillingAttestationService {
	constructor(
		private readonly ledger: BillingLedgerService,
		private readonly adjustments: BillingLineAdjustmentService,
		private readonly auditor: BillingEvidenceAuditorService,
		private readonly quarantines: BillingQuarantineService
	) {}

	async corroborate(
		manager: EntityManager,
		line: BillingLineItem,
		bundle: BillingEvidenceBundle,
		charge: AttestedCharge,
		reconciledAt: Date,
		lease: PricedLease | null
	): Promise<void> {
		if (line.evidenceStatus !== BillingEvidenceStatus.PENDING) {
			throw new Error(`Billing line ${line.id} is already reconciled`);
		}
		let effective = await this.adjustments.effectiveCharge(manager, line);
		// A spot-check quarantine may already have credited the line in full.
		const shortfallMicroUsd = charge.creditMicroUsd.min(effective);
		if (shortfallMicroUsd.isPositive()) {
			effective = await this.adjustments.credit(manager, line, {
				actorId: BILLING_LEDGER_PLATFORM_OWNER,
				amountMicroUsd: shortfallMicroUsd,
				explanation: ATTESTATION_SHORTFALL_EXPLANATION,
				reasonCode: BillingAdjustmentReasonCode.USAGE_ATTESTATION_SHORTFALL,
			});
		}
		line.reconciliationReason = attestationReason(charge);
		const verdict = this.auditor.audit(line, bundle, effective, lease);
		if (!verdict.passed) {
			await this.quarantines.quarantine(
				manager,
				line,
				bundle,
				verdict,
				effective,
				reconciledAt
			);
			effective = MicroUsd.ZERO;
		}
		line.evidenceStatus = BillingEvidenceStatus.CORROBORATED;
		line.reconciledAt = reconciledAt;
		if (effective.isPositive()) {
			await this.ledger.post(manager, usagePosting(line, charge.charged));
		}
	}
}
