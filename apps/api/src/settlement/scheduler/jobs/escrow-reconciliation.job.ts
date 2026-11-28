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
import { ESCROW_RECONCILIATION } from '../../constants/escrow.constants';
import { ChainIdentityCheckService } from '../../services/chain/chain-identity-check.service';
import { EscrowReconciliationService } from '../services/escrow/escrow-reconciliation.service';

@Injectable()
export class EscrowReconciliationJob {
	constructor(
		private readonly reconciliation: EscrowReconciliationService,
		private readonly chainIdentity: ChainIdentityCheckService
	) {}

	@ScheduledJob(CronExpression.EVERY_DAY_AT_3AM, {
		name: ESCROW_RECONCILIATION.JOB,
		waitForCompletion: true,
	})
	async reconcile(): Promise<void> {
		if (!this.chainIdentity.verified) return;
		await this.reconciliation.reconcileDue();
	}
}
