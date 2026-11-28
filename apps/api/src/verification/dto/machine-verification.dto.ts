/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import {
	BENCHMARK_BLOCKER_MESSAGE,
	BENCHMARK_DEFERRAL_GUIDANCE,
} from '../constants/benchmark-guidance.constants';
import {
	BENCHMARK_FAILURE,
	type BenchmarkFailure,
} from '../constants/benchmark-policy.constants';
import type { MachineBenchmark } from '../entities/machine-benchmark.entity';
import { BenchmarkBlocker } from '../enums/benchmark-blocker.enum';
import { BenchmarkDeferralReason } from '../enums/benchmark-deferral-reason.enum';
import { BenchmarkState } from '../enums/benchmark-state.enum';
import { BenchmarkTrigger } from '../enums/benchmark-trigger.enum';
import {
	benchmarkFailureCode,
	benchmarkFailureGuidance,
} from '../utils/benchmark/benchmark-guidance.util';

@ApiSchema({ name: 'BenchmarkFailureDetail' })
export class BenchmarkFailureDetailDto {
	@ApiProperty({
		enum: Object.values(BENCHMARK_FAILURE),
		enumName: 'BenchmarkFailureCode',
	})
	code: BenchmarkFailure;
	@ApiProperty({ description: 'What the benchmark found' })
	summary: string;
	@ApiProperty({ description: 'What the host can do about it' })
	fix: string;

	static from(code: string): BenchmarkFailureDetailDto {
		return {
			code: benchmarkFailureCode(code),
			...benchmarkFailureGuidance(code),
		};
	}
}

@ApiSchema({ name: 'BenchmarkDeferral' })
export class BenchmarkDeferralDto {
	@ApiProperty({
		enum: BenchmarkDeferralReason,
		enumName: 'BenchmarkDeferralReason',
	})
	reason: BenchmarkDeferralReason;
	@ApiProperty({ description: 'Why the benchmark was deferred' })
	summary: string;
	@ApiProperty({ description: 'What the host can do about it' })
	fix: string;

	static from(reason: BenchmarkDeferralReason): BenchmarkDeferralDto {
		return { reason, ...BENCHMARK_DEFERRAL_GUIDANCE[reason] };
	}
}

@ApiSchema({ name: 'MachineBenchmark' })
export class MachineBenchmarkDto {
	@ApiProperty({ format: 'uuid' }) id: string;
	@ApiProperty({ enum: BenchmarkTrigger, enumName: 'BenchmarkTrigger' })
	trigger: BenchmarkTrigger;
	@ApiProperty({
		enum: BenchmarkState,
		enumName: 'BenchmarkState',
		description:
			'pending while it runs; passed; deferred after a transient problem and retried automatically; failed after a problem the host must fix',
	})
	state: BenchmarkState;
	@ApiProperty() suiteVersion: number;
	@ApiProperty({
		description: 'Consecutive automatic attempts, counting this one',
	})
	attempt: number;
	@ApiProperty({ type: String, format: 'date-time' }) issuedAt: Date;
	@ApiProperty({
		type: String,
		format: 'date-time',
		description: 'When the machine must have finished the benchmark',
	})
	challengeExpiresAt: Date;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	completedAt: Date | null;
	@ApiProperty({ type: BenchmarkDeferralDto, nullable: true })
	deferral: BenchmarkDeferralDto | null;
	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description: 'When Snapflow retries a deferred benchmark',
	})
	nextAttemptAt: Date | null;
	@ApiProperty({ type: [BenchmarkFailureDetailDto] })
	failures: BenchmarkFailureDetailDto[];
	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description:
			'When a passed benchmark expires; Snapflow renews it while the machine is idle before then',
	})
	expiresAt: Date | null;

	static from(benchmark: MachineBenchmark): MachineBenchmarkDto {
		return {
			id: benchmark.id,
			trigger: benchmark.trigger,
			state: benchmark.state,
			suiteVersion: benchmark.suiteVersion,
			attempt: benchmark.attempt,
			issuedAt: benchmark.issuedAt,
			challengeExpiresAt: benchmark.challengeExpiresAt,
			completedAt: benchmark.completedAt,
			deferral: benchmark.deferralReason
				? BenchmarkDeferralDto.from(benchmark.deferralReason)
				: null,
			nextAttemptAt: benchmark.nextAttemptAt,
			failures:
				benchmark.state === BenchmarkState.FAILED
					? benchmark.failureReasons.map(BenchmarkFailureDetailDto.from)
					: [],
			expiresAt: benchmark.validUntil,
		};
	}
}

@ApiSchema({ name: 'BenchmarkRequestAvailability' })
export class BenchmarkRequestAvailabilityDto {
	@ApiProperty({ description: 'A benchmark can be requested now' })
	available: boolean;
	@ApiProperty({
		enum: BenchmarkBlocker,
		enumName: 'BenchmarkBlocker',
		nullable: true,
	})
	blocker: BenchmarkBlocker | null;
	@ApiProperty({ type: String, nullable: true })
	message: string | null;

	static from(
		blocker: BenchmarkBlocker | null
	): BenchmarkRequestAvailabilityDto {
		return {
			available: blocker === null,
			blocker,
			message: blocker ? BENCHMARK_BLOCKER_MESSAGE[blocker] : null,
		};
	}
}

@ApiSchema({ name: 'MachineVerificationChecklist' })
class MachineVerificationChecklistDto {
	@ApiProperty({
		description: 'A verified payout wallet that is not sanctioned is linked',
	})
	payoutWallet: boolean;
	@ApiProperty({
		description:
			'An unexpired benchmark passed for the current hardware inventory',
	})
	benchmark: boolean;
	@ApiProperty() fingerprintUnique: boolean;
	@ApiProperty() networkMinimum: boolean;
	@ApiProperty() diskMinimum: boolean;
	@ApiProperty() listedDays: number;
	@ApiProperty() uptimeBasisPoints: number;
	@ApiProperty() spotChecksPassed30d: number;
}

@ApiSchema({ name: 'MachineVerification' })
export class MachineVerificationDto {
	@ApiProperty({ enum: MachineTier, enumName: 'MachineTier' })
	tier: MachineTier;
	@ApiProperty({ type: [String] }) reasons: string[];
	@ApiProperty({ type: MachineVerificationChecklistDto })
	checklist: MachineVerificationChecklistDto;
	@ApiProperty({ type: MachineBenchmarkDto, nullable: true })
	latestBenchmark: MachineBenchmarkDto | null;
	@ApiProperty({
		type: String,
		format: 'date-time',
		nullable: true,
		description:
			'When the passed benchmark the machine is listed on expires; the machine is treated as not benchmarked afterwards',
	})
	benchmarkExpiresAt: Date | null;
	@ApiProperty({ type: BenchmarkRequestAvailabilityDto })
	benchmarkRequest: BenchmarkRequestAvailabilityDto;
}
