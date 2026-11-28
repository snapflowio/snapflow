/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes } from 'node:crypto';
import { LockMode, QueryOrder, RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { addMinutes } from '../../../common/utils/time.util';
import type { ResourceShape } from '../../../common/values/resource-shape.value';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { Machine } from '../../../machine/entities/machine.entity';
import { MachineState } from '../../../machine/enums/machine-state.enum';
import { UNFINISHED_JOB_STATUSES } from '../../../machine-job/constants/job-execution.constants';
import { Job } from '../../../machine-job/entities/job.entity';
import { JobType } from '../../../machine-job/enums/job-type.enum';
import { ResourceType } from '../../../machine-job/enums/resource-type.enum';
import { JobService } from '../../../machine-job/services/job.service';
import { SandboxPlacement } from '../../../sandbox/entities/sandbox-placement.entity';
import { BENCHMARK_BLOCKER_MESSAGE } from '../../constants/benchmark-guidance.constants';
import {
	AUTOMATIC_BENCHMARK_TRIGGERS,
	BENCHMARK_BLOCKER_DEFERRAL,
	BENCHMARK_POLICY,
	BENCHMARK_PROTOCOL,
	BENCHMARK_SUITE_VERSION,
} from '../../constants/benchmark-policy.constants';
import { MachineBenchmark } from '../../entities/machine-benchmark.entity';
import { BenchmarkBlocker } from '../../enums/benchmark-blocker.enum';
import { BenchmarkState } from '../../enums/benchmark-state.enum';
import { BenchmarkTrigger } from '../../enums/benchmark-trigger.enum';
import { findMachinesDueForBenchmark } from '../../queries/verification.query';
import { registrationChallenge } from '../../utils/benchmark/benchmark-challenge.util';
import {
	benchmarkRenewalHorizon,
	deferBenchmark,
} from '../../utils/benchmark/benchmark-outcome.util';
import { benchmarkShape } from '../../utils/benchmark/benchmark-shape.util';
import { SpeedtestReceiptService } from '../speedtest/speedtest-receipt.service';
import { SpeedtestTokenService } from '../speedtest/speedtest-token.service';

type BenchmarkReadiness =
	| { blocker: BenchmarkBlocker }
	| { blocker: null; shape: ResourceShape; speedtestUrl: string };

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
			const due = await findMachinesDueForBenchmark(this.entityManager, {
				now,
				renewalHorizon: benchmarkRenewalHorizon(now),
				limit: BENCHMARK_POLICY.ISSUE_BATCH_SIZE,
			});
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
		return this.entityManager.transactional((manager) =>
			this.create(manager, machineId, trigger)
		);
	}

	async blocker(
		manager: EntityManager,
		machine: Machine
	): Promise<BenchmarkBlocker | null> {
		return (await this.readiness(manager, machine)).blocker;
	}

	private async create(
		manager: EntityManager,
		machineId: string,
		trigger: BenchmarkTrigger
	): Promise<MachineBenchmark> {
		const machine = await manager.findOneOrFail(
			Machine,
			{ id: machineId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		const readiness = await this.readiness(manager, machine);
		if (readiness.blocker) {
			const deferral = AUTOMATIC_BENCHMARK_TRIGGERS.has(trigger)
				? BENCHMARK_BLOCKER_DEFERRAL[readiness.blocker]
				: undefined;
			if (!deferral) {
				throw new ConflictException({
					code: readiness.blocker,
					message: BENCHMARK_BLOCKER_MESSAGE[readiness.blocker],
				});
			}
			const benchmark = await this.draft(
				manager,
				machine,
				trigger,
				benchmarkShape(machine)
			);
			deferBenchmark(benchmark, deferral, benchmark.issuedAt);
			manager.persist(benchmark);
			await manager.flush();
			return benchmark;
		}
		const benchmark = await this.draft(
			manager,
			machine,
			trigger,
			readiness.shape
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
				readiness.speedtestUrl,
				this.speedtestTokens.mint({
					id: benchmark.id,
					expiresAt: benchmark.challengeExpiresAt,
				})
			)
		);
		benchmark.jobId = job.id;
		await manager.flush();
		return benchmark;
	}

	private async draft(
		manager: EntityManager,
		machine: Machine,
		trigger: BenchmarkTrigger,
		shape: ResourceShape
	): Promise<MachineBenchmark> {
		const now = await databaseNow(manager);
		const columns = shape.toColumns();
		const benchmark = new MachineBenchmark();
		benchmark.machineId = machine.id;
		benchmark.trigger = trigger;
		benchmark.attempt = await this.nextAttempt(manager, machine.id, trigger);
		benchmark.suiteVersion = BENCHMARK_SUITE_VERSION;
		benchmark.nonce = randomBytes(BENCHMARK_PROTOCOL.NONCE_BYTES).toString(
			'hex'
		);
		benchmark.inventoryDigest = machine.inventoryDigest;
		benchmark.release = machine.appVersion;
		benchmark.cpu = columns.cpu;
		benchmark.memoryGib = columns.memoryGib;
		benchmark.diskGib = columns.diskGib;
		benchmark.gpu = columns.gpu;
		benchmark.issuedAt = now;
		benchmark.challengeExpiresAt = addMinutes(
			now,
			BENCHMARK_POLICY.CHALLENGE_TTL_MINUTES
		);
		return benchmark;
	}

	private async nextAttempt(
		manager: EntityManager,
		machineId: string,
		trigger: BenchmarkTrigger
	): Promise<number> {
		if (trigger !== BenchmarkTrigger.RETRY) return 1;
		const latest = await manager.findOne(
			MachineBenchmark,
			{ machineId },
			{ orderBy: { issuedAt: QueryOrder.DESC }, fields: ['attempt', 'state'] }
		);
		return latest?.state === BenchmarkState.DEFERRED ? latest.attempt + 1 : 1;
	}

	private async readiness(
		manager: EntityManager,
		machine: Machine
	): Promise<BenchmarkReadiness> {
		if (machine.state !== MachineState.READY) {
			return { blocker: BenchmarkBlocker.MACHINE_NOT_READY };
		}
		if (!machine.identityKeyId) {
			return { blocker: BenchmarkBlocker.MACHINE_KEY_MISSING };
		}
		const [pending, placements, qualifications] = await Promise.all([
			manager.count(MachineBenchmark, {
				machineId: machine.id,
				state: BenchmarkState.PENDING,
			}),
			manager.count(SandboxPlacement, {
				machineId: machine.id,
				releasedAt: null,
			}),
			manager.count(Job, {
				machineId: machine.id,
				type: JobType.QUALIFY_MACHINE,
				status: { $in: UNFINISHED_JOB_STATUSES },
			}),
		]);
		if (pending > 0) return { blocker: BenchmarkBlocker.BENCHMARK_PENDING };
		if (placements > 0 || qualifications > 0) {
			return { blocker: BenchmarkBlocker.MACHINE_BUSY };
		}
		const shape = benchmarkShape(machine);
		if (shape.diskGiB === 0) {
			return { blocker: BenchmarkBlocker.DISK_UNAVAILABLE };
		}
		const speedtestUrl = await this.speedtests.endpoint(manager, machine.id);
		if (!speedtestUrl) {
			return { blocker: BenchmarkBlocker.SPEEDTEST_UNAVAILABLE };
		}
		return { blocker: null, shape, speedtestUrl };
	}
}
