/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { JsonObject } from '@bufbuild/protobuf';
import { LockMode, RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { MachineMarketplaceService } from '../../../marketplace/machine/services/machine-marketplace.service';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { Job } from '../../../sandbox/machine-job/entities/job.entity';
import { JobStatus } from '../../../sandbox/machine-job/enums/job-status.enum';
import {
	BENCHMARK_FAILURE,
	BENCHMARK_PARAMETERS,
	BENCHMARK_POLICY,
	type BenchmarkFailure,
} from '../constants/benchmark-policy.constants';
import { VerificationEvents } from '../constants/verification-events.constants';
import { MachineBenchmark } from '../entities/machine-benchmark.entity';
import { BenchmarkState } from '../enums/benchmark-state.enum';
import { VerificationReviewKind } from '../enums/verification-review-kind.enum';
import { BenchmarkPassedEvent } from '../events/benchmark-passed.event';
import { benchmarkNotAdmitted } from '../utils/benchmark-admission.util';
import { appraiseBenchmarkResult } from '../utils/benchmark-appraisal.util';
import { hasIntegrityFailure } from '../utils/benchmark-integrity.util';
import { BenchmarkReleaseService } from './benchmark-release.service';
import { FingerprintService } from './fingerprint.service';
import { SpeedtestReceiptService } from './speedtest-receipt.service';
import { SpeedtestTokenService } from './speedtest-token.service';
import { VerificationReviewService } from './verification-review.service';

interface AppraisableRow {
	id: string;
}

const MEASUREMENTS_FIELD = 'measurements';

function parseJsonObject(text: string | null): JsonObject | null {
	if (!text) return null;
	try {
		const value: unknown = JSON.parse(text);
		return isJsonObject(value) ? value : null;
	} catch {
		return null;
	}
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class BenchmarkAppraisalService extends TrackedJobs {
	protected readonly logger = new Logger(BenchmarkAppraisalService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly machines: MachineMarketplaceService,
		private readonly fingerprints: FingerprintService,
		private readonly speedtests: SpeedtestReceiptService,
		private readonly speedtestTokens: SpeedtestTokenService,
		private readonly reviews: VerificationReviewService,
		private readonly benchmarkReleases: BenchmarkReleaseService,
		private readonly events: EventEmitter2
	) {
		super();
	}

	@TrackJobExecution()
	async appraiseSettled(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const rows = await this.entityManager.execute<AppraisableRow[]>(
				`SELECT benchmark.id AS "id"
				   FROM "machine_benchmark" benchmark
				   LEFT JOIN "job" job ON job.id = benchmark."jobId"
				  WHERE benchmark.state = ?
				    AND (job."completedAt" IS NOT NULL OR benchmark."expiresAt" <= now())
				  ORDER BY benchmark."issuedAt"
				  LIMIT ?`,
				[BenchmarkState.PENDING, BENCHMARK_POLICY.APPRAISAL_BATCH_SIZE]
			);
			for (const { id } of rows) {
				try {
					await this.appraise(id);
				} catch (error) {
					this.logger.error(`Failed to appraise benchmark ${id}`, error);
				}
			}
		});
	}

	async appraise(benchmarkId: string): Promise<void> {
		const settled = await this.entityManager.transactional(async (manager) => {
			const benchmark = await manager.findOne(
				MachineBenchmark,
				{ id: benchmarkId, state: BenchmarkState.PENDING },
				{ lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE }
			);
			if (!benchmark) return null;
			const now = await databaseNow(manager);
			const job = benchmark.jobId
				? await manager.findOne(Job, { id: benchmark.jobId })
				: null;
			if (!job?.completedAt) {
				if (benchmark.expiresAt <= now) {
					benchmark.state = BenchmarkState.EXPIRED;
					benchmark.completedAt = now;
				}
				return benchmark;
			}
			benchmark.completedAt = job.completedAt;
			benchmark.evidenceDigest = job.resultDigest;
			if (benchmarkNotAdmitted(job)) {
				benchmark.state = BenchmarkState.NOT_ADMITTED;
				return benchmark;
			}
			if (job.status !== JobStatus.COMPLETED) {
				await this.fail(manager, benchmark, [BENCHMARK_FAILURE.JOB_FAILED]);
				return benchmark;
			}
			await this.settle(manager, benchmark, job);
			return benchmark;
		});
		if (settled?.state === BenchmarkState.PASSED) {
			await this.events.emitAsync(
				VerificationEvents.BENCHMARK_PASSED,
				new BenchmarkPassedEvent(settled.machineId)
			);
		}
	}

	private async settle(
		manager: EntityManager,
		benchmark: MachineBenchmark,
		job: Job
	): Promise<void> {
		const resultJson = parseJsonObject(job.resultMetadata);
		if (!resultJson) {
			await this.fail(manager, benchmark, [BENCHMARK_FAILURE.MALFORMED_RESULT]);
			return;
		}
		const measurements = resultJson[MEASUREMENTS_FIELD];
		benchmark.measurements = isJsonObject(measurements) ? measurements : null;
		const machine = await manager.findOneOrFail(Machine, {
			id: benchmark.machineId,
		});
		const appraisal = appraiseBenchmarkResult({
			benchmark,
			job,
			machine,
			machineInventoryDigest: machine.inventoryDigest,
			speedtestTokens: this.speedtestTokens.candidates(benchmark),
			resultJson,
			trustedBenchmarkImage: await this.benchmarkReleases.trustedBenchmarkImage(
				machine.runtimeCapabilities
			),
			edgeKeys: await this.speedtests.edgeKeys(manager),
			parameters: BENCHMARK_PARAMETERS,
		});
		if (!appraisal.passed) {
			await this.fail(manager, benchmark, appraisal.failures);
			return;
		}
		benchmark.state = BenchmarkState.PASSED;
		benchmark.failureReasons = [];
		await manager.flush();
		await this.machines.applyMeasurements(
			manager,
			benchmark.machineId,
			appraisal.measurements,
			appraisal.inventory
		);
		await this.fingerprints.record(
			manager,
			benchmark.machineId,
			appraisal.fingerprints,
			benchmark.id
		);
	}

	private async fail(
		manager: EntityManager,
		benchmark: MachineBenchmark,
		failures: readonly BenchmarkFailure[]
	): Promise<void> {
		benchmark.state = BenchmarkState.FAILED;
		benchmark.failureReasons = [...failures];
		const previouslyPassed = await manager.count(MachineBenchmark, {
			machineId: benchmark.machineId,
			state: BenchmarkState.PASSED,
		});
		if (previouslyPassed > 0 && hasIntegrityFailure(failures)) {
			await this.reviews.open(
				manager,
				benchmark.machineId,
				VerificationReviewKind.BENCHMARK_REGRESSION,
				benchmark.id
			);
		}
		await manager.flush();
	}
}
