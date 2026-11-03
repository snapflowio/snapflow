/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { MachineJobNotificationService } from '../../machine/services/machine-job-notification.service';
import { Job } from '../entities/job.entity';
import { JobProjectionStatus } from '../enums/job-projection-status.enum';
import { JobStatus } from '../enums/job-status.enum';
import { JobType } from '../enums/job-type.enum';
import { ResourceType } from '../enums/resource-type.enum';
import { JobService } from './job.service';

const MACHINE_ID = 'machine-1';
const SANDBOX_ID = 'sandbox-1';
const ASSIGNMENT_GENERATION = 4;
const NOW = new Date('2026-10-04T12:00:00.000Z');

function serviceWithTransaction() {
	const transaction = fakeInstance(EntityManager);
	mock.method(transaction, 'execute', async () => [{ now: NOW }]);
	const updates: Partial<Job>[] = [];
	const nativeUpdate = mock.method(
		transaction,
		'nativeUpdate',
		async (...update: [unknown, unknown, Partial<Job>]) => {
			updates.push(update[2]);
			return 1;
		}
	);
	const persisted: Job[] = [];
	mock.method(transaction, 'persist', (job: Job) => {
		persisted.push(job);
		return transaction;
	});
	const entityManager = fakeInstance(EntityManager);
	mock.method(
		entityManager,
		'transactional',
		async (work: (manager: EntityManager) => Promise<unknown>) =>
			work(transaction)
	);
	const notifications = fakeInstance(MachineJobNotificationService);
	const notify = mock.method(notifications, 'notify', () => undefined);
	const service = new JobService(entityManager, notifications);
	return { service, nativeUpdate, updates, persisted, notify };
}

describe('JobService.createJob', () => {
	it('supersedes unleased jobs of the same request before inserting the new one', async () => {
		const { service, nativeUpdate, updates, persisted, notify } =
			serviceWithTransaction();

		const job = await service.createJob(
			null,
			JobType.CREATE_BACKUP,
			MACHINE_ID,
			ResourceType.SANDBOX,
			SANDBOX_ID,
			'{}',
			{ assignmentGeneration: ASSIGNMENT_GENERATION, supersedePending: true }
		);

		const [entity, where] = nativeUpdate.mock.calls[0].arguments;
		const [update] = updates;
		assert.ok(update);
		assert.equal(entity, Job);
		assert.deepEqual(where, {
			type: JobType.CREATE_BACKUP,
			machineId: MACHINE_ID,
			resourceType: ResourceType.SANDBOX,
			resourceId: SANDBOX_ID,
			status: JobStatus.PENDING,
			leaseToken: null,
		});
		assert.equal(update.status, JobStatus.FAILED);
		assert.equal(update.projectionStatus, JobProjectionStatus.NOT_REQUIRED);
		assert.deepEqual(persisted, [job]);
		assert.equal(job.assignmentGeneration, ASSIGNMENT_GENERATION);
		assert.deepEqual(notify.mock.calls[0].arguments, [MACHINE_ID, job.id]);
	});

	it('leaves other pending jobs alone unless asked to supersede', async () => {
		const { service, nativeUpdate } = serviceWithTransaction();

		await service.createJob(
			null,
			JobType.SNAPSHOT_SANDBOX,
			MACHINE_ID,
			ResourceType.SANDBOX,
			SANDBOX_ID
		);

		assert.equal(nativeUpdate.mock.callCount(), 0);
	});
});
