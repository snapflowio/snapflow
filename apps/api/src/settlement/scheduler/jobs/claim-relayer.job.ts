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
import { CLAIM_RELAYER } from '../../constants/payment-channel.constants';
import { ClaimRelayerService } from '../services/claim-relayer.service';

// Runs every minute so vouchers near expiry are claimed early; each channel
// is otherwise claimed once per claim interval setting.
@Injectable()
export class ClaimRelayerJob {
	constructor(private readonly relayer: ClaimRelayerService) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: CLAIM_RELAYER.JOB,
		waitForCompletion: true,
	})
	relayClaims(): Promise<void> {
		return this.relayer.relayClaims();
	}
}
