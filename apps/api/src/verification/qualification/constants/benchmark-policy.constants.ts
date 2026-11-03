/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BenchmarkParameters } from '../types/benchmark.types';

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;
const SPEEDTEST_TOKEN_BUDGET_GIB = 128;

export const BENCHMARK_SUITE_VERSION = 2;

export const GUEST_RELEASE = {
	REPOSITORY: 'snapflowio/platform',
	ARTIFACT_ANNOTATION: 'io.snapflow.platform.artifact',
	BENCHMARK_ARTIFACT: 'benchmark',
	BENCHMARK_ARTIFACT_TYPE: 'application/vnd.snapflow.guest.benchmark.v1',
	INDEX_MEDIA_TYPE: 'application/vnd.oci.image.index.v1+json',
	IMAGE_MEDIA_TYPE: 'application/vnd.oci.image.manifest.v1+json',
	DIGEST_PREFIX: 'sha256:',
	PLATFORM_SEPARATOR: '/',
	REFERENCE_DIGEST_SEPARATOR: '@',
	REQUEST_TIMEOUT_MILLISECONDS: 5_000,
	MAXIMUM_INDEX_BYTES: 4 * MEBIBYTE,
} as const;

export const BENCHMARK_PROTOCOL = {
	DOMAIN: 'snapflow-machine-benchmark-v1',
	NONCE_BYTES: 32,
	DIGEST_BYTES: 32,
	CHACHA20_KEY_BYTES: 32,
	CHACHA20_IV_BYTES: 16,
	CHACHA20_BLOCK_INDEX_OFFSET: 8,
	CPU_SEGMENT_ITERATIONS: 65_536,
	CPU_SAMPLE_COUNT: 48,
	GEMM_SAMPLE_COUNT: 8,
	GEMM_DIMENSION: 4_096,
	GEMM_ELEMENT_MASK: 0x07,
	GEMM_ELEMENT_OFFSET: 4,
	GEMM_ELEMENT_BYTES: 4,
	SAMPLE_INDEX_BYTES: 8,
	SPEEDTEST_RECEIPT_DOMAIN: 'snapflow.speedtest-receipt.v2',
} as const;

export const BENCHMARK_LABEL = {
	CPU: 'cpu',
	CPU_SEED: 'cpu-seed',
	GEMM: 'gemm',
	GEMM_A: 'gemm-a',
	GEMM_B: 'gemm-b',
	STREAM: 'stream',
	SAMPLE: 'sample',
} as const;

export const BENCHMARK_POLICY = {
	CHALLENGE_TTL_MINUTES: 60,
	REISSUE_INTERVAL_MINUTES: 60,
	MINIMUM_CAPACITY_BASIS_POINTS: 9_500,
	GUEST_MEMORY_ALLOWANCE_BYTES: 512 * MEBIBYTE,
	GUEST_VRAM_ALLOWANCE_BYTES: GIBIBYTE,
	MINIMUM_CPU_WORK_MILLISECONDS: 15_000,
	MINIMUM_SERVER_OBSERVED_MILLISECONDS: 60_000,
	// Provisional: recalibrate against live suite v2 scores.
	MINIMUM_CPU_SCORE_PER_VCPU: 250,
	MAXIMUM_PAGE_TOUCH_P999_MICROSECONDS: 100,
	MINIMUM_SPEEDTEST_BYTES: 64 * MEBIBYTE,
	BYTES_PER_GIB: GIBIBYTE,
	BITS_PER_BYTE: 8,
	BITS_PER_MEGABIT_PER_MILLISECOND: 1_000,
	APPRAISAL_BATCH_SIZE: 10,
	ISSUE_BATCH_SIZE: 50,
} as const;

export const BENCHMARK_PARAMETERS: Readonly<BenchmarkParameters> = {
	cpuSegmentIterations: BENCHMARK_PROTOCOL.CPU_SEGMENT_ITERATIONS,
	cpuSampleCount: BENCHMARK_PROTOCOL.CPU_SAMPLE_COUNT,
	gemmDimension: BENCHMARK_PROTOCOL.GEMM_DIMENSION,
	gemmSampleCount: BENCHMARK_PROTOCOL.GEMM_SAMPLE_COUNT,
	minimumCapacityBasisPoints: BENCHMARK_POLICY.MINIMUM_CAPACITY_BASIS_POINTS,
	guestMemoryAllowanceBytes: BENCHMARK_POLICY.GUEST_MEMORY_ALLOWANCE_BYTES,
	guestVramAllowanceBytes: BENCHMARK_POLICY.GUEST_VRAM_ALLOWANCE_BYTES,
	minimumCpuWorkMillis: BENCHMARK_POLICY.MINIMUM_CPU_WORK_MILLISECONDS,
	minimumServerObservedMillis:
		BENCHMARK_POLICY.MINIMUM_SERVER_OBSERVED_MILLISECONDS,
	minimumCpuScorePerVcpu: BENCHMARK_POLICY.MINIMUM_CPU_SCORE_PER_VCPU,
	maximumPageTouchP999Micros:
		BENCHMARK_POLICY.MAXIMUM_PAGE_TOUCH_P999_MICROSECONDS,
	minimumSpeedtestBytes: BENCHMARK_POLICY.MINIMUM_SPEEDTEST_BYTES,
};

export const SPEEDTEST_TOKEN = {
	SIGNATURE_DOMAIN: 'snapflow.speedtest-token.v1',
	KEY_DERIVATION_DOMAIN: 'speedtest-token-signing',
	KEY_DERIVATION_SUBJECT: 'ed25519-seed-v1',
	VERSION: 1,
	BYTE_BUDGET: BigInt(SPEEDTEST_TOKEN_BUDGET_GIB) * BigInt(GIBIBYTE),
	KEY_SEPARATOR: '.',
	VERSION_BYTES: 1,
	UUID_BYTES: 16,
	UINT64_BYTES: 8,
	ED25519_SEED_BYTES: 32,
	ED25519_PKCS8_PREFIX: '302e020100300506032b657004220420',
} as const;

export const SPEEDTEST_ENDPOINT = {
	PROTOCOL: 'https:',
	PATH: '/_snapflow/speedtest',
} as const;

export const BENCHMARK_ERROR_CODE = {
	MACHINE_BUSY: 'machine_busy',
	BENCHMARK_PENDING: 'benchmark_pending',
	MACHINE_KEY_MISSING: 'machine_key_missing',
	SPEEDTEST_UNAVAILABLE: 'speedtest_unavailable',
	DISK_UNAVAILABLE: 'disk_unavailable',
} as const;

export const BENCHMARK_JOB = {
	APPRAISE: 'appraise-machine-benchmarks',
	ISSUE: 'issue-machine-benchmarks',
} as const;

export const BENCHMARK_FAILURE = {
	JOB_FAILED: 'job_failed',
	MALFORMED_RESULT: 'malformed_result',
	WRONG_BENCHMARK: 'wrong_benchmark',
	BENCHMARK_IMAGE_UNTRUSTED: 'benchmark_image_untrusted',
	WRONG_SESSION: 'wrong_session',
	WRONG_KEY: 'wrong_machine_key',
	SIGNATURE_INVALID: 'signature_invalid',
	SIGNED_OUTSIDE_WINDOW: 'signed_outside_window',
	INVENTORY_INVALID: 'inventory_invalid',
	INVENTORY_CHANGED: 'inventory_changed',
	WORK_TOO_SHORT: 'work_too_short',
	CPU_PROOF_INVALID: 'cpu_proof_invalid',
	CPU_THREADS_MISMATCH: 'cpu_threads_mismatch',
	CPU_SCORE_LOW: 'cpu_score_low',
	MEMORY_CAPACITY_LOW: 'memory_capacity_low',
	MEMORY_OVERCOMMITTED: 'memory_overcommitted',
	DISK_MISSING: 'disk_missing',
	SPEEDTEST_INVALID: 'speedtest_invalid',
	SPEEDTEST_MISSING: 'speedtest_missing',
	GPU_COUNT_MISMATCH: 'gpu_count_mismatch',
	GPU_UNRECOGNIZED: 'gpu_unrecognized',
	GPU_MIXED_MODELS: 'gpu_mixed_models',
	GPU_NOT_IN_INVENTORY: 'gpu_not_in_inventory',
	VRAM_CAPACITY_LOW: 'vram_capacity_low',
	GEMM_PROOF_INVALID: 'gemm_proof_invalid',
	GPU_TFLOPS_OUT_OF_BAND: 'gpu_tflops_out_of_band',
	GPU_PCIE_DEGRADED: 'gpu_pcie_degraded',
	GPU_MEMORY_ERRORS: 'gpu_memory_errors',
} as const;

export type BenchmarkFailure =
	(typeof BENCHMARK_FAILURE)[keyof typeof BENCHMARK_FAILURE];

export const BENCHMARK_INTEGRITY_FAILURES: ReadonlySet<string> =
	new Set<BenchmarkFailure>([
		BENCHMARK_FAILURE.SIGNATURE_INVALID,
		BENCHMARK_FAILURE.BENCHMARK_IMAGE_UNTRUSTED,
		BENCHMARK_FAILURE.INVENTORY_INVALID,
		BENCHMARK_FAILURE.CPU_PROOF_INVALID,
		BENCHMARK_FAILURE.GEMM_PROOF_INVALID,
		BENCHMARK_FAILURE.SPEEDTEST_INVALID,
		BENCHMARK_FAILURE.GPU_NOT_IN_INVENTORY,
	]);
