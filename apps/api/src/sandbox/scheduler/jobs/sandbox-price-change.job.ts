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
import { SANDBOX_PRICE_JOB } from '../../constants/sandbox-placement.constants';
import { SandboxPriceChangeManager } from '../../managers/sandbox-price-change.manager';

@Injectable()
export class SandboxPriceChangeJob {
	constructor(private readonly priceChanges: SandboxPriceChangeManager) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: SANDBOX_PRICE_JOB.PRICE_CHANGE,
	})
	applyPriceChanges(): Promise<void> {
		return this.priceChanges.applyPriceChanges();
	}
}
