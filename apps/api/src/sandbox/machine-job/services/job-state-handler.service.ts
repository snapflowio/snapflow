/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { JobProjector } from '../decorators/job-projector.decorator';
import type { Job } from '../entities/job.entity';
import { JobStatus } from '../enums/job-status.enum';
import type { JobType } from '../enums/job-type.enum';
import type {
	JobProjection,
	JobTypeProjector,
} from '../types/job-projection.types';

const TERMINAL_JOB_STATUSES: ReadonlySet<JobStatus> = new Set([
	JobStatus.COMPLETED,
	JobStatus.FAILED,
]);

@Injectable()
export class JobStateHandlerService implements OnModuleInit {
	private readonly projections = new Map<JobType, JobProjection>();

	constructor(private readonly discovery: DiscoveryService) {}

	onModuleInit(): void {
		const wrappers = this.discovery.getProviders({
			metadataKey: JobProjector.KEY,
		});
		for (const { instance } of wrappers) {
			const projector: JobTypeProjector = instance;
			for (const [type, projection] of projector.projections) {
				if (this.projections.has(type)) {
					throw new Error(`Job type ${type} has more than one projector`);
				}
				this.projections.set(type, projection);
			}
		}
	}

	projectedTypes(): JobType[] {
		return [...this.projections.keys()];
	}

	async handleJobCompletion(job: Job): Promise<void> {
		if (!TERMINAL_JOB_STATUSES.has(job.status)) return;
		return this.projections.get(job.type)?.(job);
	}
}
