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
import { BillingEvidenceStatus } from '../../billing/constants/billing.constants';
import {
	BILLING_AUDIT_FAULT_DOMAIN,
	BillingAuditFailure,
} from '../../billing/constants/billing-audit.constants';
import { BillingLineItem } from '../../billing/entities/billing-line-item.entity';
import { BillingLineAdjustmentService } from '../../billing/services/billing-line-adjustment.service';
import type { FailedBillingAudit } from '../../billing/services/evidence/billing-evidence-auditor.service';
import { BillingQuarantineService } from '../../billing/services/evidence/billing-quarantine.service';
import { MachineMarketplaceService } from '../../marketplace/services/machine-marketplace.service';
import { SPOT_CHECK_FAILURE } from '../constants/spot-check.constants';
import type { MachineSpotCheck } from '../entities/machine-spot-check.entity';
import { VerificationReviewKind } from '../enums/verification-review-kind.enum';
import { lastVerifiedPassAt } from '../queries/verification.query';
import { VerificationReviewService } from './verification-review.service';

const SPOT_CHECK_QUARANTINE: FailedBillingAudit = {
	passed: false,
	failure: BillingAuditFailure.MACHINE_VERIFICATION_FAILED,
	faultDomain:
		BILLING_AUDIT_FAULT_DOMAIN[BillingAuditFailure.MACHINE_VERIFICATION_FAILED],
	detail: 'The machine failed a verification spot check',
};

@Injectable()
export class SpotCheckFailureService {
	constructor(
		private readonly machines: MachineMarketplaceService,
		private readonly reviews: VerificationReviewService,
		private readonly quarantine: BillingQuarantineService,
		private readonly adjustments: BillingLineAdjustmentService
	) {}

	async handle(
		manager: EntityManager,
		check: MachineSpotCheck,
		now: Date
	): Promise<void> {
		const kind = check.failureReasons.includes(
			SPOT_CHECK_FAILURE.NETWORK_METER_INFLATED
		)
			? VerificationReviewKind.NETWORK_METER_INFLATED
			: VerificationReviewKind.SPOT_CHECK_FAILED;
		await this.machines.restrict(manager, check.machineId, kind);
		const since = await lastVerifiedPassAt(manager, check.machineId, now);
		const lines = await manager.find(BillingLineItem, {
			machineId: check.machineId,
			evidenceStatus: BillingEvidenceStatus.PENDING,
			periodEnd: { $gt: since },
		});
		for (const line of lines) {
			await this.quarantine.quarantine(
				manager,
				line,
				null,
				SPOT_CHECK_QUARANTINE,
				await this.adjustments.effectiveCharge(manager, line),
				now
			);
		}
		await this.reviews.open(manager, check.machineId, kind, check.id);
		await manager.flush();
	}
}
