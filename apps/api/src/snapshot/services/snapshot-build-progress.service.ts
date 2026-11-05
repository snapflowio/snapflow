/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Job } from '../../machine-job/entities/job.entity';
import { JobStatus } from '../../machine-job/enums/job-status.enum';
import { JobType } from '../../machine-job/enums/job-type.enum';
import { ResourceType } from '../../machine-job/enums/resource-type.enum';
import { SnapshotMachine } from '../entities/snapshot-machine.entity';
import { SnapshotMachineState } from '../enums/snapshot-machine-state.enum';

const UNFINISHED_JOB_STATUSES = [JobStatus.PENDING, JobStatus.IN_PROGRESS];

export type BuildProgress =
	| { kind: 'held'; builtAt: Date | null }
	| { kind: 'building' }
	| { kind: 'failed'; errorReason: string | null }
	| { kind: 'absent' };

@Injectable()
export class SnapshotBuildProgressService {
	constructor(private readonly entityManager: EntityManager) {}

	async progressOn(
		machineId: string,
		ref: string,
		since: Date
	): Promise<BuildProgress> {
		const job = await this.entityManager.findOne(
			Job,
			{
				type: JobType.BUILD_SNAPSHOT,
				resourceType: ResourceType.SNAPSHOT,
				resourceId: ref,
				machineId,
			},
			{ orderBy: { createdAt: QueryOrder.DESC } }
		);
		const held = await this.entityManager.count(SnapshotMachine, {
			machineId,
			snapshotRef: ref,
			state: SnapshotMachineState.PRESENT,
		});
		if (held > 0) {
			return {
				kind: 'held',
				builtAt:
					job?.status === JobStatus.COMPLETED && job.createdAt >= since
						? job.completedAt
						: null,
			};
		}
		if (!job) return { kind: 'absent' };
		if (UNFINISHED_JOB_STATUSES.includes(job.status))
			return { kind: 'building' };
		if (job.status === JobStatus.FAILED && job.createdAt >= since) {
			return { kind: 'failed', errorReason: job.errorMessage };
		}
		return job.status === JobStatus.COMPLETED && job.createdAt >= since
			? { kind: 'building' }
			: { kind: 'absent' };
	}

	async failureSince(
		ref: string,
		since: Date
	): Promise<{ errorReason: string | null } | null> {
		const job = await this.entityManager.findOne(
			Job,
			{
				type: JobType.BUILD_SNAPSHOT,
				resourceType: ResourceType.SNAPSHOT,
				resourceId: ref,
				status: JobStatus.FAILED,
				createdAt: { $gte: since },
			},
			{ orderBy: { createdAt: QueryOrder.DESC } }
		);
		return job ? { errorReason: job.errorMessage } : null;
	}

	async machinesBuilding(ref: string): Promise<string[]> {
		const jobs = await this.entityManager.find(
			Job,
			{
				type: JobType.BUILD_SNAPSHOT,
				resourceType: ResourceType.SNAPSHOT,
				resourceId: ref,
				status: { $in: UNFINISHED_JOB_STATUSES },
			},
			{ fields: ['machineId'], orderBy: { createdAt: QueryOrder.ASC } }
		);
		return [...new Set(jobs.map(({ machineId }) => machineId))];
	}
}
