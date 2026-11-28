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
import { VOUCHER_ISSUER } from '../../constants/payment-channel.constants';
import { ChainIdentityCheckService } from '../../services/chain/chain-identity-check.service';
import { VoucherIssuerService } from '../services/vouchers/voucher-issuer.service';

@Injectable()
export class VoucherIssuerJob {
	constructor(
		private readonly issuer: VoucherIssuerService,
		private readonly chainIdentity: ChainIdentityCheckService
	) {}

	@ScheduledJob(CronExpression.EVERY_5_SECONDS, {
		name: VOUCHER_ISSUER.JOB,
		waitForCompletion: true,
	})
	async issueDueVouchers(): Promise<void> {
		if (!this.chainIdentity.verified) return;
		await this.issuer.issueDueVouchers();
	}
}
