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
import { SANDBOX_LEASE_JOB } from '../../instance/constants/sandbox-placement.constants';
import { SandboxLeaseRenewalManager } from '../../instance/managers/sandbox-lease-renewal.manager';

@Injectable()
export class SandboxLeaseRenewalJob {
	constructor(
		private readonly sandboxLeaseRenewalManager: SandboxLeaseRenewalManager
	) {}

	@ScheduledJob(CronExpression.EVERY_10_MINUTES, {
		name: SANDBOX_LEASE_JOB.RENEWAL,
	})
	renewExpiredLeases(): Promise<void> {
		return this.sandboxLeaseRenewalManager.renewExpiredLeases();
	}
}
