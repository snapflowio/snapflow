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
import { SandboxIdlePolicyManager } from '../../instance/managers/sandbox-idle-policy.manager';

@Injectable()
export class SandboxIdlePolicyJob {
	constructor(
		private readonly sandboxIdlePolicyManager: SandboxIdlePolicyManager
	) {}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, { name: 'auto-stop-check' })
	autostopCheck(): Promise<void> {
		return this.sandboxIdlePolicyManager.autostopCheck();
	}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, { name: 'auto-archive-check' })
	autoArchiveCheck(): Promise<void> {
		return this.sandboxIdlePolicyManager.autoArchiveCheck();
	}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, { name: 'auto-delete-check' })
	autoDeleteCheck(): Promise<void> {
		return this.sandboxIdlePolicyManager.autoDeleteCheck();
	}
}
