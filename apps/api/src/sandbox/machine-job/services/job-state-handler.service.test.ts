/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	type INestApplicationContext,
	Injectable,
	Module,
	type Provider,
	type Type,
} from '@nestjs/common';
import { DiscoveryModule, NestFactory } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { SandboxArtifactJobProjector } from '../../services/backup/sandbox-artifact-job.projector';
import { SnapshotRepository } from '../../snapshot/repositories/snapshot.repository';
import { SnapshotActivationService } from '../../snapshot/services/snapshot-activation.service';
import { SnapshotJobProjector } from '../../snapshot/services/snapshot-job.projector';
import { SnapshotPublicationService } from '../../snapshot/services/snapshot-publication.service';
import { VolumeBackupService } from '../../volume/services/volume-backup.service';
import { VolumeJobProjector } from '../../volume/services/volume-job.projector';
import { JobProjector } from '../decorators/job-projector.decorator';
import { Job } from '../entities/job.entity';
import { JobStatus } from '../enums/job-status.enum';
import { JobType } from '../enums/job-type.enum';
import { ResourceType } from '../enums/resource-type.enum';
import type {
	JobProjection,
	JobTypeProjector,
} from '../types/job-projection.types';
import { JobStateHandlerService } from './job-state-handler.service';

const PROJECTED_JOB_TYPES = [
	JobType.CREATE_BACKUP,
	JobType.BACKUP_VOLUMES,
	JobType.SNAPSHOT_SANDBOX,
	JobType.PUBLISH_SNAPSHOT,
	JobType.BUILD_SNAPSHOT,
	JobType.DELETE_VOLUME,
	JobType.RESIZE_VOLUME,
	JobType.RESTORE_VOLUME,
];

const PROJECTOR_DEPENDENCIES = [
	EntityManager,
	EventEmitter2,
	SandboxRepository,
	SnapshotRepository,
	SnapshotActivationService,
	SnapshotPublicationService,
	VolumeBackupService,
];

const contexts: INestApplicationContext[] = [];

function job(type: JobType, status: JobStatus): Job {
	return new Job({
		type,
		status,
		machineId: 'machine-1',
		resourceType: ResourceType.VOLUME,
		resourceId: 'volume-1',
	});
}

function recordingProjector(
	projected: Job[],
	...types: JobType[]
): Type<JobTypeProjector> {
	@JobProjector()
	@Injectable()
	class RecordingProjector implements JobTypeProjector {
		readonly projections = new Map<JobType, JobProjection>(
			types.map((type) => [
				type,
				async (projectedJob: Job) => {
					projected.push(projectedJob);
				},
			])
		);
	}
	return RecordingProjector;
}

async function handlerWith(
	providers: Provider[]
): Promise<JobStateHandlerService> {
	@Module({
		imports: [DiscoveryModule],
		providers: [JobStateHandlerService, ...providers],
	})
	class JobStateHandlerTestModule {}

	const app = await NestFactory.createApplicationContext(
		JobStateHandlerTestModule,
		{ logger: false, abortOnError: false }
	);
	contexts.push(app);
	return app.get(JobStateHandlerService);
}

describe('JobStateHandlerService', () => {
	after(async () => {
		await Promise.all(contexts.map((context) => context.close()));
	});

	it('routes a terminal job to the projection registered for its type', async () => {
		const projected: Job[] = [];
		const handler = await handlerWith([
			recordingProjector(projected, JobType.DELETE_VOLUME),
		]);
		const completed = job(JobType.DELETE_VOLUME, JobStatus.COMPLETED);
		const failed = job(JobType.DELETE_VOLUME, JobStatus.FAILED);

		await handler.handleJobCompletion(completed);
		await handler.handleJobCompletion(failed);

		assert.deepEqual(projected, [completed, failed]);
	});

	it('ignores unfinished jobs and job types without a projection', async () => {
		const projected: Job[] = [];
		const handler = await handlerWith([
			recordingProjector(projected, JobType.DELETE_VOLUME),
		]);

		await handler.handleJobCompletion(
			job(JobType.DELETE_VOLUME, JobStatus.IN_PROGRESS)
		);
		await handler.handleJobCompletion(
			job(JobType.RESIZE_VOLUME, JobStatus.COMPLETED)
		);

		assert.deepEqual(projected, []);
	});

	it('refuses two projections for one job type', async () => {
		await assert.rejects(
			handlerWith([
				recordingProjector([], JobType.BUILD_SNAPSHOT),
				recordingProjector([], JobType.BUILD_SNAPSHOT),
			]),
			/more than one projector/
		);
	});

	it('covers each projected job type exactly once with the real projectors', async () => {
		const handler = await handlerWith([
			SandboxArtifactJobProjector,
			SnapshotJobProjector,
			VolumeJobProjector,
			...PROJECTOR_DEPENDENCIES.map((provide) => ({ provide, useValue: {} })),
		]);
		assert.deepEqual(
			handler.projectedTypes().sort(),
			[...PROJECTED_JOB_TYPES].sort()
		);
	});
});
