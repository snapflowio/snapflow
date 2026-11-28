/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MACHINE_HOST_REPORT_LIMITS = {
	maximumChecks: 64,
	maximumCheckNameLength: 64,
	maximumTextLength: 2_048,
	maximumHolds: 1_000,
	maximumBenchmarkFieldLength: 256,
	maximumBenchmarkSamples: 100,
} as const;

export const MACHINE_DIAGNOSTIC_CHECK_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const TRAFFIC_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const BYTE_COUNT_PATTERN = /^\d{1,20}$/;
