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
import { ServiceUnavailableException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Redis } from 'ioredis';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { fakeInstance, fakeValue } from '../../../common/testing/instance.fake';
import { CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS } from '../../../infra/control-wake/constants/control-wake.constants';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { TransactionCommitHooks } from '../../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import { MACHINE_JOB_WAKE_TOPIC } from '../../machine/constants/machine-job-wake.constants';
import { MachineJobNotificationService } from '../../machine/services/machine-job-notification.service';
import { type JobDto, PollJobsRequestDto } from '../dto/job.dto';
import { JobLeaseService } from './job-lease.service';
import { JobPollService } from './job-poll.service';

const MACHINE_ID = '5e000000-0000-4000-8000-000000000005';
const SESSION_ID = '6f000000-0000-4000-8000-000000000006';
const JOB_ID = '7a000000-0000-4000-8000-000000000007';
const LIMIT = 10;
const LONG_TIMEOUT_SECONDS = 30;
const SHORT_TIMEOUT_SECONDS = 1;
const PROMPT_MILLISECONDS = 1_000;
const RECEIVING_CLIENTS = 1;

function harness(claims: JobDto[][]) {
	const wakes = new ControlWakeService(
		fakeInstance(Redis, {
			duplicate: () => fakeInstance(Redis, { on: () => undefined }),
			publish: async () => RECEIVING_CLIENTS,
		}),
		new TransactionCommitHooks(
			fakeInstance(EntityManager, {
				getEventManager: () => ({ registerSubscriber: () => undefined }),
			})
		)
	);
	const notifications = new MachineJobNotificationService(wakes);
	const remaining = [...claims];
	const leases = fakeInstance(JobLeaseService);
	const claimPendingJobs = mock.method(
		leases,
		'claimPendingJobs',
		async () => remaining.shift() ?? []
	);
	return {
		wakes,
		notifications,
		claimPendingJobs,
		polls: new JobPollService(leases, wakes),
	};
}

const job = fakeValue<JobDto>({ id: JOB_ID });

describe('JobPollService', () => {
	it('returns claimable jobs without waiting', async () => {
		const { polls, claimPendingJobs } = harness([[job]]);

		const jobs = await polls.pollJobs(
			MACHINE_ID,
			SESSION_ID,
			LIMIT,
			LONG_TIMEOUT_SECONDS
		);

		assert.deepEqual(jobs, [job]);
		assert.equal(claimPendingJobs.mock.callCount(), 1);
	});

	it('wakes a parked poll when a job is enqueued', async () => {
		const test = harness([[], [job]]);
		const startedAt = Date.now();

		const polling = test.polls.pollJobs(
			MACHINE_ID,
			SESSION_ID,
			LIMIT,
			LONG_TIMEOUT_SECONDS
		);
		await new Promise((resolve) => setImmediate(resolve));
		test.notifications.notify(MACHINE_ID, JOB_ID);

		assert.deepEqual(await polling, [job]);
		assert.ok(Date.now() - startedAt < PROMPT_MILLISECONDS);
	});

	it('loses no job enqueued between the claim and the wait registration', async () => {
		const test = harness([]);
		test.claimPendingJobs.mock.mockImplementationOnce(async () => {
			test.notifications.notify(MACHINE_ID, JOB_ID);
			return [];
		});
		test.claimPendingJobs.mock.mockImplementationOnce(async () => [job]);
		const startedAt = Date.now();

		const jobs = await test.polls.pollJobs(
			MACHINE_ID,
			SESSION_ID,
			LIMIT,
			LONG_TIMEOUT_SECONDS
		);

		assert.deepEqual(jobs, [job]);
		assert.ok(Date.now() - startedAt < PROMPT_MILLISECONDS);
	});

	it('releases the parked poll when the machine disconnects', async () => {
		const test = harness([]);
		const disconnect = new AbortController();

		const polling = test.polls.pollJobs(
			MACHINE_ID,
			SESSION_ID,
			LIMIT,
			LONG_TIMEOUT_SECONDS,
			disconnect.signal
		);
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(test.wakes.waiterCount(MACHINE_JOB_WAKE_TOPIC, MACHINE_ID), 1);
		disconnect.abort();

		assert.deepEqual(await polling, []);
		assert.equal(test.wakes.waiterCount(MACHINE_JOB_WAKE_TOPIC, MACHINE_ID), 0);
		assert.equal(test.claimPendingJobs.mock.callCount(), 1);
	});

	it('returns no jobs once the wait elapses', async () => {
		const { polls } = harness([]);

		const jobs = await polls.pollJobs(
			MACHINE_ID,
			SESSION_ID,
			LIMIT,
			SHORT_TIMEOUT_SECONDS
		);

		assert.deepEqual(jobs, []);
	});

	it('refuses parked polls while the API shuts down', async () => {
		const test = harness([]);

		const polling = test.polls.pollJobs(
			MACHINE_ID,
			SESSION_ID,
			LIMIT,
			LONG_TIMEOUT_SECONDS
		);
		await new Promise((resolve) => setImmediate(resolve));
		test.wakes.beforeApplicationShutdown();

		await assert.rejects(polling, ServiceUnavailableException);
	});

	it('never parks a poll beyond the shared long-poll budget', async () => {
		const test = harness([]);
		const waits = mock.method(
			test.wakes,
			'waitForChange',
			async () => undefined
		);

		await test.polls.pollJobs(
			MACHINE_ID,
			SESSION_ID,
			LIMIT,
			LONG_TIMEOUT_SECONDS
		);

		assert.equal(
			waits.mock.calls[0]?.arguments[3],
			CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS * MILLISECONDS_PER_SECOND
		);
	});

	it('rejects a poll request beyond the shared long-poll budget', async () => {
		const within = plainToInstance(PollJobsRequestDto, {
			timeout: String(CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS),
		});
		const beyond = plainToInstance(PollJobsRequestDto, {
			timeout: String(CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS + 1),
		});

		assert.deepEqual(await validate(within), []);
		assert.equal((await validate(beyond)).length, 1);
		assert.equal(
			plainToInstance(PollJobsRequestDto, {}).timeout,
			CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS
		);
	});
});
