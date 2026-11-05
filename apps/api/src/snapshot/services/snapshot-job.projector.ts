/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JobProjector } from '../../machine-job/decorators/job-projector.decorator';
import { Job } from '../../machine-job/entities/job.entity';
import { JobStatus } from '../../machine-job/enums/job-status.enum';
import { JobType } from '../../machine-job/enums/job-type.enum';
import type {
	JobProjection,
	JobTypeProjector,
} from '../../machine-job/types/job-projection.types';
import { getSnapshotJobResultMetadata } from '../../machine-job/utils/job-result-metadata.util';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import {
	publishSnapshotBuildSettled,
	SnapshotBuildSettledEvent,
} from '../events/snapshot-build-settled.event';
import { SnapshotRepository } from '../repositories/snapshot.repository';
import { SnapshotActivationService } from './snapshot-activation.service';
import { SnapshotPublicationService } from './snapshot-publication.service';

const PUBLISH_FAILURE_REASON = 'Failed to publish snapshot';
const BUILD_FAILURE_REASON = 'Failed to build snapshot';
const INVALID_RESULT_REASON = 'The machine returned an invalid snapshot result';

@JobProjector()
@Injectable()
export class SnapshotJobProjector implements JobTypeProjector {
	readonly projections: ReadonlyMap<JobType, JobProjection> = new Map<
		JobType,
		JobProjection
	>([
		[JobType.PUBLISH_SNAPSHOT, (job) => this.projectPublish(job)],
		[JobType.BUILD_SNAPSHOT, (job) => this.projectBuild(job)],
	]);

	private readonly logger = new Logger(SnapshotJobProjector.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly snapshotRepository: SnapshotRepository,
		private readonly publication: SnapshotPublicationService,
		private readonly activation: SnapshotActivationService,
		private readonly eventEmitter: EventEmitter2
	) {}

	async projectPublish(job: Job): Promise<void> {
		const snapshot = await this.entityManager.findOne(Snapshot, {
			initialMachineId: job.machineId,
			ref: job.resourceId,
			state: SnapshotState.PULLING,
		});
		if (!snapshot) return;
		await this.project(
			job,
			snapshot,
			SnapshotState.ERROR,
			PUBLISH_FAILURE_REASON
		);
	}

	async projectBuild(job: Job): Promise<void> {
		if (job.status !== JobStatus.COMPLETED) {
			publishSnapshotBuildSettled(
				this.eventEmitter,
				this.logger,
				new SnapshotBuildSettledEvent(job.machineId, [job.resourceId])
			);
		}
		const snapshot = await this.entityManager.findOne(
			Snapshot,
			{
				initialMachineId: job.machineId,
				buildInfo: { snapshotRef: job.resourceId },
				state: SnapshotState.BUILDING,
			},
			{ populate: ['buildInfo'] }
		);
		if (!snapshot) return;
		await this.project(
			job,
			snapshot,
			SnapshotState.BUILD_FAILED,
			BUILD_FAILURE_REASON
		);
	}

	private async project(
		job: Job,
		snapshot: Snapshot,
		failedState: SnapshotState,
		failureReason: string
	): Promise<void> {
		if (job.status !== JobStatus.COMPLETED) {
			this.logger.error(
				`${job.type} job ${job.id} failed for snapshot ${snapshot.id}: ${job.errorMessage}`
			);
			await this.fail(snapshot, failedState, job.errorMessage || failureReason);
			return;
		}
		const result = getSnapshotJobResultMetadata(job);
		if (!result) {
			await this.fail(snapshot, failedState, INVALID_RESULT_REASON);
			return;
		}
		const accepted = await this.publication.recordPublishedImage(snapshot, {
			hash: result.hash,
			sizeGB: result.sizeGB,
			entrypoint: result.entrypoint,
		});
		if (accepted) {
			await this.activation.activateIfHeld(snapshot);
		}
	}

	private async fail(
		snapshot: Snapshot,
		state: SnapshotState,
		errorReason: string
	): Promise<void> {
		await this.snapshotRepository.update(snapshot.id, {
			updateData: { state, errorReason },
			entity: snapshot,
		});
	}
}
