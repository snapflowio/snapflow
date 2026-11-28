/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { FUNDING_POLICY } from '../../../billing/constants/funding.constants';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { SandboxFundingPolicyService } from '../../services/sandbox/sandbox-funding-policy.service';

@Injectable()
export class SandboxFundingPolicyJob {
	constructor(
		private readonly sandboxFundingPolicyService: SandboxFundingPolicyService
	) {}

	@ScheduledJob(FUNDING_POLICY.jobSchedule, {
		name: FUNDING_POLICY.jobName,
		waitForCompletion: true,
	})
	apply(): Promise<void> {
		return this.sandboxFundingPolicyService.apply();
	}
}
