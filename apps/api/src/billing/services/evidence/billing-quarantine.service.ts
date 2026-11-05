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
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	BILLING_LEDGER_PLATFORM_OWNER,
	BillingAdjustmentReasonCode,
	BillingReconciliationReason,
} from '../../constants/billing.constants';
import { BILLING_AUDIT_POLICY_VERSION } from '../../constants/billing-audit.constants';
import type { BillingEvidenceBundle } from '../../entities/billing-evidence-bundle.entity';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import { BillingLineQuarantine } from '../../entities/billing-line-quarantine.entity';
import { BillingLineAdjustmentService } from '../billing-line-adjustment.service';
import type { FailedBillingAudit } from './billing-evidence-auditor.service';

const QUARANTINE_EXPLANATION =
	'The evidence of this line failed the billing audit, so it was not charged and was credited in full.';

@Injectable()
export class BillingQuarantineService {
	constructor(private readonly adjustments: BillingLineAdjustmentService) {}

	async quarantine(
		manager: EntityManager,
		line: BillingLineItem,
		bundle: BillingEvidenceBundle | null,
		verdict: FailedBillingAudit,
		effectiveMicroUsd: MicroUsd,
		quarantinedAt: Date
	): Promise<void> {
		const existing = await manager.findOne(BillingLineQuarantine, {
			lineItemId: line.id,
		});
		if (existing) return;
		if (effectiveMicroUsd.isPositive()) {
			await this.adjustments.credit(manager, line, {
				actorId: BILLING_LEDGER_PLATFORM_OWNER,
				amountMicroUsd: effectiveMicroUsd,
				explanation: `${QUARANTINE_EXPLANATION} Audit failure: ${verdict.failure}.`,
				reasonCode: BillingAdjustmentReasonCode.EVIDENCE_QUARANTINED,
			});
		}
		line.reconciliationReason =
			BillingReconciliationReason.EVIDENCE_QUARANTINED;
		manager.persist(
			manager.create(BillingLineQuarantine, {
				lineItemId: line.id,
				machineId: line.machineId,
				failureCode: verdict.failure,
				faultDomain: verdict.faultDomain,
				evidenceRoot: bundle?.root ?? null,
				auditPolicyVersion: BILLING_AUDIT_POLICY_VERSION,
				quarantinedAt,
			})
		);
	}
}
