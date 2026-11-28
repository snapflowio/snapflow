/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { apiError } from '../../common/utils/error/api-error.util';
import { CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS } from '../../infra/control-wake/constants/control-wake.constants';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import { MACHINE_JOB_WAKE_TOPIC } from '../../machine/constants/machine-job-wake.constants';
import { JOB_POLL_DEFAULT_LIMIT } from '../constants/job-execution.constants';
import type { JobDto } from '../dto/job.dto';
import { MachineJobApiErrorCode } from '../enums/machine-job-api-error-code.enum';
import { JobLeaseService } from './job-lease.service';

const SHUTDOWN_MESSAGE =
	'Job polling is paused while Snapflow restarts. Poll again in a few seconds.';

@Injectable()
export class JobPollService {
	constructor(
		private readonly jobLeaseService: JobLeaseService,
		private readonly wakes: ControlWakeService
	) {}

	async pollJobs(
		machineId: string,
		machineSessionId: string,
		limit = JOB_POLL_DEFAULT_LIMIT,
		timeoutSeconds = CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS,
		abortSignal?: AbortSignal
	): Promise<JobDto[]> {
		this.assertAvailable();
		if (abortSignal?.aborted) return [];
		const wakeVersion = this.wakes.capture(MACHINE_JOB_WAKE_TOPIC, machineId);
		const claimed = await this.jobLeaseService.claimPendingJobs(
			machineId,
			machineSessionId,
			limit
		);
		if (claimed.length > 0) return claimed;
		await this.wakes.waitForChange(
			MACHINE_JOB_WAKE_TOPIC,
			machineId,
			wakeVersion,
			Math.min(timeoutSeconds, CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS) *
				MILLISECONDS_PER_SECOND,
			abortSignal
		);
		if (abortSignal?.aborted) return [];
		this.assertAvailable();
		return this.jobLeaseService.claimPendingJobs(
			machineId,
			machineSessionId,
			limit
		);
	}

	private assertAvailable(): void {
		if (this.wakes.isStopping()) {
			throw new ServiceUnavailableException(
				apiError(MachineJobApiErrorCode.POLLING_UNAVAILABLE, SHUTDOWN_MESSAGE)
			);
		}
	}
}
