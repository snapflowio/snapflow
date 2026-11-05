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
import { DrainingMachineManager } from '../../managers/draining-machine/draining-machine.manager';

@Injectable()
export class DrainingMachineJob {
	constructor(
		private readonly drainingMachineManager: DrainingMachineManager
	) {}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: 'draining-machine-sandboxes-check',
	})
	drainingMachineSandboxesCheck(): Promise<void> {
		return this.drainingMachineManager.drainingMachineSandboxesCheck();
	}
}
