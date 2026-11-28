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
import { SETTLEMENT_OPERATOR } from '../../constants/host-settlement.constants';
import { ChainIdentityCheckService } from '../../services/chain/chain-identity-check.service';
import { SettlementOperatorService } from '../services/operator/settlement-operator.service';

@Injectable()
export class SettlementOperatorJob {
	constructor(
		private readonly operator: SettlementOperatorService,
		private readonly chainIdentity: ChainIdentityCheckService
	) {}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: SETTLEMENT_OPERATOR.JOB,
		waitForCompletion: true,
	})
	async operate(): Promise<void> {
		if (!this.chainIdentity.verified) return;
		await this.operator.operate();
	}
}
