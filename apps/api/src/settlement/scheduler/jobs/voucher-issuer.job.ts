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
import { VoucherIssuerService } from '../services/voucher-issuer.service';

// Runs often and only picks channels whose voucher interval setting has
// passed, so the interval can change without a deploy.
@Injectable()
export class VoucherIssuerJob {
	constructor(private readonly issuer: VoucherIssuerService) {}

	@ScheduledJob(CronExpression.EVERY_5_SECONDS, {
		name: VOUCHER_ISSUER.JOB,
		waitForCompletion: true,
	})
	issueDueVouchers(): Promise<void> {
		return this.issuer.issueDueVouchers();
	}
}
