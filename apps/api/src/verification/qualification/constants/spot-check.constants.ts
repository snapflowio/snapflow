/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const SPOT_CHECK_BENCHMARK_TOOL = {
	BUILD_DIRECTORY: 'machine-benchmark',
	BINARY_NAME: 'machine-benchmark',
	PLATFORMS: ['linux/amd64', 'linux/arm64'],
	SANDBOX_DIRECTORY: '/tmp',
} as const;

export const SPOT_CHECK = {
	LEASE_LOOKBACK_DAYS: 30,
	PASS_LOOKBACK_DAYS: 30,
	INTERVAL_MINIMUM_BASIS_POINTS: 5_000,
	INTERVAL_MAXIMUM_BASIS_POINTS: 15_000,
	START_TIMEOUT_MINUTES: 30,
	CHALLENGE_TTL_MINUTES: 120,
	COMMAND_TIMEOUT_SECONDS: 1_800,
	LOCK_TTL_SECONDS: 2_100,
	LOCK_KEY_PREFIX: 'machine-spot-check-',
	TOOLBOX_SESSION_SECONDS: 2_400,
	ENVIRONMENT_NAME_PREFIX: 'V',
	ENVIRONMENT_NAME_BYTES: 6,
	BATCH_SIZE: 20,
	SUCCESS_EXIT_CODE: 0,
} as const;

export const SPOT_CHECK_JOB = {
	SCHEDULE: 'schedule-machine-spot-checks',
	EXECUTE: 'execute-machine-spot-checks',
} as const;

export const SPOT_CHECK_TOLERANCE_SUBJECT = 'Spot-check tolerance';

export const SPOT_CHECK_FAILURE = {
	CPU_SCORE_REGRESSED: 'cpu_score_regressed',
	MEMORY_BANDWIDTH_REGRESSED: 'memory_bandwidth_regressed',
	GPU_TFLOPS_REGRESSED: 'gpu_tflops_regressed',
	DISK_IOPS_REGRESSED: 'disk_iops_regressed',
	DISK_THROUGHPUT_REGRESSED: 'disk_throughput_regressed',
	NETWORK_METER_INFLATED: 'network_meter_inflated',
	NETWORK_METER_UNDERCOUNTED: 'network_meter_undercounted',
} as const;

export const SPOT_CHECK_CANARY = {
	MINIMUM_BYTES: 16n * 1_024n * 1_024n,
	BYTE_SPREAD: 48n * 1_024n * 1_024n,
	RANDOM_BYTES: 8,
	DOWNLOAD_SECONDS: 30,
	TOKEN_TTL_MINUTES: 10,
	REPORT_SETTLE_MILLISECONDS: 45_000,
	MEASUREMENT_TIMEOUT_MINUTES: 10,
	OVERHEAD_BASIS_POINTS: 1_000n,
	IDLE_ALLOWANCE_BYTES: 2n * 1_024n * 1_024n,
} as const;

export const SPOT_CHECK_ABORT = {
	ORGANIZATION_UNSET: 'spot_check_organization_unset',
	SNAPSHOT_UNSET: 'default_snapshot_unset',
	CREDENTIAL_MISSING: 'spot_check_credential_missing',
	MACHINE_UNAVAILABLE: 'machine_unavailable',
	SANDBOX_FAILED: 'sandbox_failed',
	START_TIMEOUT: 'start_timeout',
	TOOLBOX_UNAVAILABLE: 'toolbox_unavailable',
	COMMAND_FAILED: 'command_failed',
	PLATFORM_UNSUPPORTED: 'platform_unsupported',
	MALFORMED_OUTPUT: 'malformed_output',
	BASELINE_MISSING: 'baseline_missing',
	CANARY_FAILED: 'canary_failed',
	CANARY_UNMEASURED: 'canary_unmeasured',
} as const;

export type SpotCheckFailure =
	(typeof SPOT_CHECK_FAILURE)[keyof typeof SPOT_CHECK_FAILURE];

export type SpotCheckAbort =
	(typeof SPOT_CHECK_ABORT)[keyof typeof SPOT_CHECK_ABORT];
