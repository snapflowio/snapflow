/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { BillingEvidenceRetentionService } from '../../ledger/services/evidence/billing-evidence-retention.service';

@Injectable()
export class BillingEvidenceRetentionJob {
	constructor(
		private readonly billingEvidenceRetentionService: BillingEvidenceRetentionService
	) {}

	@ScheduledJob(CronExpression.EVERY_HOUR, {
		name: 'prune-posted-billing-evidence',
		waitForCompletion: true,
	})
	prune(): Promise<void> {
		return this.billingEvidenceRetentionService.prune();
	}
}
