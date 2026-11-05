/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes } from 'node:crypto';
import { LockMode, RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { addMinutes } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Machine } from '../../machine/entities/machine.entity';
import type { Job } from '../../machine-job/entities/job.entity';
import { JobType } from '../../machine-job/enums/job-type.enum';
import { ResourceType } from '../../machine-job/enums/resource-type.enum';
import { JobService } from '../../machine-job/services/job.service';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import {
	BENCHMARK_ERROR_CODE,
	BENCHMARK_POLICY,
	BENCHMARK_PROTOCOL,
	BENCHMARK_SUITE_VERSION,
} from '../constants/benchmark-policy.constants';
import { MachineBenchmark } from '../entities/machine-benchmark.entity';
import { BenchmarkState } from '../enums/benchmark-state.enum';
import type { BenchmarkTrigger } from '../enums/benchmark-trigger.enum';
import { findMachinesDueForBenchmark } from '../queries/verification.query';
import { registrationChallenge } from '../utils/benchmark-challenge.util';
import { benchmarkShape } from '../utils/benchmark-shape.util';
import { SpeedtestReceiptService } from './speedtest-receipt.service';
import { SpeedtestTokenService } from './speedtest-token.service';

@Injectable()
export class MachineBenchmarkService extends TrackedJobs {
	protected readonly logger = new Logger(MachineBenchmarkService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly jobs: JobService,
		private readonly speedtests: SpeedtestReceiptService,
		private readonly speedtestTokens: SpeedtestTokenService
	) {
		super();
	}

	@TrackJobExecution()
	async issueDue(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const now = await databaseNow(this.entityManager);
			const due = await findMachinesDueForBenchmark(
				this.entityManager,
				addMinutes(now, -BENCHMARK_POLICY.REISSUE_INTERVAL_MINUTES),
				BENCHMARK_POLICY.ISSUE_BATCH_SIZE
			);
			for (const { machineId, trigger } of due) {
				try {
					await this.issue(machineId, trigger);
				} catch (error) {
					this.logger.warn(
						`Could not issue a benchmark to machine ${machineId}`,
						error
					);
				}
			}
		});
	}

	async issue(
		machineId: string,
		trigger: BenchmarkTrigger
	): Promise<MachineBenchmark> {
		const { benchmark, job } = await this.entityManager.transactional(
			(manager) => this.create(manager, machineId, trigger)
		);
		this.jobs.notifyCreatedJob(job);
		return benchmark;
	}

	private async create(
		manager: EntityManager,
		machineId: string,
		trigger: BenchmarkTrigger
	): Promise<{ benchmark: MachineBenchmark; job: Job }> {
		const machine = await manager.findOneOrFail(
			Machine,
			{ id: machineId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!machine.identityKeyId) {
			throw new ConflictException({
				code: BENCHMARK_ERROR_CODE.MACHINE_KEY_MISSING,
				message: 'The machine has no enrolled identity key',
			});
		}
		const now = await databaseNow(manager);
		await this.expireStale(manager, machineId, now);
		await this.assertIdle(manager, machineId);
		const speedtestUrl = await this.speedtests.endpoint(manager, machineId);
		if (!speedtestUrl) {
			throw new ConflictException({
				code: BENCHMARK_ERROR_CODE.SPEEDTEST_UNAVAILABLE,
				message: 'No edge can run the network benchmark',
			});
		}
		const benchmark = new MachineBenchmark();
		benchmark.machineId = machineId;
		benchmark.trigger = trigger;
		benchmark.suiteVersion = BENCHMARK_SUITE_VERSION;
		benchmark.nonce = randomBytes(BENCHMARK_PROTOCOL.NONCE_BYTES).toString(
			'hex'
		);
		const admittable = benchmarkShape(machine);
		if (admittable.diskGiB === 0) {
			throw new ConflictException({
				code: BENCHMARK_ERROR_CODE.DISK_UNAVAILABLE,
				message: 'The machine has no unallocated disk to benchmark',
			});
		}
		const shape = admittable.toColumns();
		benchmark.cpu = shape.cpu;
		benchmark.memoryGib = shape.memoryGib;
		benchmark.diskGib = shape.diskGib;
		benchmark.gpu = shape.gpu;
		benchmark.issuedAt = now;
		benchmark.expiresAt = addMinutes(
			now,
			BENCHMARK_POLICY.CHALLENGE_TTL_MINUTES
		);
		manager.persist(benchmark);
		await manager.flush();
		const job = await this.jobs.createJob(
			manager,
			JobType.BENCHMARK_MACHINE,
			machineId,
			ResourceType.MACHINE,
			machineId,
			registrationChallenge(
				benchmark,
				speedtestUrl,
				this.speedtestTokens.mint(benchmark)
			)
		);
		benchmark.jobId = job.id;
		await manager.flush();
		return { benchmark, job };
	}

	private async expireStale(
		manager: EntityManager,
		machineId: string,
		now: Date
	): Promise<void> {
		await manager.nativeUpdate(
			MachineBenchmark,
			{ machineId, state: BenchmarkState.PENDING, expiresAt: { $lte: now } },
			{ state: BenchmarkState.EXPIRED, completedAt: now }
		);
		const pending = await manager.count(MachineBenchmark, {
			machineId,
			state: BenchmarkState.PENDING,
		});
		if (pending > 0) {
			throw new ConflictException({
				code: BENCHMARK_ERROR_CODE.BENCHMARK_PENDING,
				message: 'A benchmark is already running on this machine',
			});
		}
	}

	private async assertIdle(
		manager: EntityManager,
		machineId: string
	): Promise<void> {
		const active = await manager.count(SandboxPlacement, {
			machineId: machineId,
			releasedAt: null,
		});
		if (active > 0) {
			throw new ConflictException({
				code: BENCHMARK_ERROR_CODE.MACHINE_BUSY,
				message: 'Benchmarks run only while the machine runs no sandboxes',
			});
		}
	}
}
