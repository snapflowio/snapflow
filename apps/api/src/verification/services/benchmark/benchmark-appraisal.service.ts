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
import { MachineCheck } from '../../../machine/constants/machine-check.constants';
import { MachineEvents } from '../../../machine/constants/machine-events.constants';
import { Machine } from '../../../machine/entities/machine.entity';
import { MachineCheckFailedEvent } from '../../../machine/events/machine-check-failed.event';
import { Job } from '../../../machine-job/entities/job.entity';
import { JobStatus } from '../../../machine-job/enums/job-status.enum';
import { MachineMarketplaceService } from '../../../marketplace/services/machine-marketplace.service';
import {
	enqueueMachineCheckFailed,
	noticeKey,
} from '../../../notification/utils/notice-outbox.util';
import {
	BENCHMARK_FAILURE,
	BENCHMARK_PARAMETERS,
	BENCHMARK_POLICY,
	type BenchmarkFailure,
} from '../../constants/benchmark-policy.constants';
import { VerificationEvents } from '../../constants/verification-events.constants';
import { MachineBenchmark } from '../../entities/machine-benchmark.entity';
import { BenchmarkDeferralReason } from '../../enums/benchmark-deferral-reason.enum';
import { BenchmarkState } from '../../enums/benchmark-state.enum';
import { VerificationReviewKind } from '../../enums/verification-review-kind.enum';
import { BenchmarkPassedEvent } from '../../events/benchmark-passed.event';
import { appraiseBenchmarkResult } from '../../utils/benchmark/benchmark-appraisal.util';
import { hasIntegrityFailure } from '../../utils/benchmark/benchmark-integrity.util';
import {
	benchmarkValidUntil,
	deferBenchmark,
	failureDeferralReason,
	jobDeferralReason,
} from '../../utils/benchmark/benchmark-outcome.util';
import { FingerprintService } from '../fingerprint.service';
import { SpeedtestReceiptService } from '../speedtest/speedtest-receipt.service';
import { SpeedtestTokenService } from '../speedtest/speedtest-token.service';
import { VerificationReviewService } from '../verification-review.service';
import { BenchmarkReleaseService } from './benchmark-release.service';

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
				    AND (job."completedAt" IS NOT NULL OR benchmark."challengeExpiresAt" <= now())
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
				if (benchmark.challengeExpiresAt <= now) {
					deferBenchmark(
						benchmark,
						BenchmarkDeferralReason.CHALLENGE_EXPIRED,
						now
					);
					await manager.flush();
				}
				return benchmark;
			}
			benchmark.evidenceDigest = job.resultDigest;
			const deferral = jobDeferralReason(job);
			if (deferral) {
				deferBenchmark(benchmark, deferral, job.completedAt);
				await manager.flush();
				return benchmark;
			}
			benchmark.completedAt = job.completedAt;
			if (job.status !== JobStatus.COMPLETED) {
				await this.fail(manager, benchmark, [BENCHMARK_FAILURE.JOB_FAILED]);
				return benchmark;
			}
			await this.settle(manager, benchmark, job, job.completedAt);
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
		job: Job,
		completedAt: Date
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
			speedtestTokens: this.speedtestTokens.candidates({
				id: benchmark.id,
				expiresAt: benchmark.challengeExpiresAt,
			}),
			resultJson,
			trustedBenchmarkImage: await this.benchmarkReleases.trustedBenchmarkImage(
				machine.runtimeCapabilities
			),
			edgeKeys: await this.speedtests.edgeKeys(manager),
			parameters: BENCHMARK_PARAMETERS,
		});
		if (!appraisal.passed) {
			const deferral = failureDeferralReason(appraisal.failures);
			if (deferral) {
				benchmark.failureReasons = [...appraisal.failures];
				deferBenchmark(benchmark, deferral, completedAt);
				await manager.flush();
				return;
			}
			await this.fail(manager, benchmark, appraisal.failures);
			return;
		}
		benchmark.state = BenchmarkState.PASSED;
		benchmark.failureReasons = [];
		benchmark.validUntil = benchmarkValidUntil(completedAt);
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
		await this.noticeFailure(manager, benchmark, failures);
	}

	private async noticeFailure(
		manager: EntityManager,
		benchmark: MachineBenchmark,
		failures: readonly BenchmarkFailure[]
	): Promise<void> {
		const machine = await manager.findOne(
			Machine,
			{ id: benchmark.machineId },
			{ fields: ['organizationId'] }
		);
		if (!machine?.organizationId || !benchmark.completedAt) return;
		await enqueueMachineCheckFailed(
			manager,
			new MachineCheckFailedEvent(
				machine.organizationId,
				benchmark.machineId,
				MachineCheck.BENCHMARK,
				failures,
				benchmark.completedAt
			),
			noticeKey(MachineEvents.CHECK_FAILED, benchmark.id)
		);
	}
}
