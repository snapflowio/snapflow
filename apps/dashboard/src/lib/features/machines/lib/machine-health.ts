/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type MachineDiagnosticCheck,
	MachineDiagnosticStatus,
	type MachineLocalBenchmark,
	type MachineMeasurementDistribution,
	MachinePaymentHoldReason,
} from '@snapflow/api-client';
import { DISPLAY_LOCALE, formatBytes } from '#lib/utils/format.ts';

const NANOSECONDS_PER_MILLISECOND = 1_000_000;
const MILLISECOND_FORMAT = new Intl.NumberFormat(DISPLAY_LOCALE, {
	maximumFractionDigits: 1,
});

const DIAGNOSTIC_ORDER = {
	[MachineDiagnosticStatus.Failed]: 0,
	[MachineDiagnosticStatus.Pending]: 1,
	[MachineDiagnosticStatus.Ok]: 2,
} as const satisfies Record<MachineDiagnosticStatus, number>;

export const PAYMENT_HOLD_REASON_LABELS = {
	[MachinePaymentHoldReason.PaymentWindowLapsed]: 'Payment window lapsed',
	[MachinePaymentHoldReason.FundsUnreadable]: 'Funds could not be read',
	[MachinePaymentHoldReason.FloatExceeded]: 'Payout reserve exceeded',
} as const satisfies Record<MachinePaymentHoldReason, string>;

export function sortedDiagnostics(
	checks: readonly MachineDiagnosticCheck[]
): MachineDiagnosticCheck[] {
	return checks.toSorted(
		(left, right) =>
			DIAGNOSTIC_ORDER[left.status] - DIAGNOSTIC_ORDER[right.status] ||
			Number(right.required) - Number(left.required)
	);
}

function formatNanoseconds(nanoseconds: number): string {
	return `${MILLISECOND_FORMAT.format(nanoseconds / NANOSECONDS_PER_MILLISECOND)} ms`;
}

function formatThroughput(bytesPerSecond: number): string {
	return `${formatBytes(bytesPerSecond)}/s`;
}

function formatDistribution(
	distribution: MachineMeasurementDistribution,
	format: (value: number) => string
): string {
	return `p50 ${format(distribution.p50)} · p95 ${format(distribution.p95)} · p99 ${format(distribution.p99)}`;
}

export function formatLatencyDistribution(
	distribution: MachineMeasurementDistribution
): string {
	return formatDistribution(distribution, formatNanoseconds);
}

export function formatThroughputDistribution(
	distribution: MachineMeasurementDistribution
): string {
	return formatDistribution(distribution, formatThroughput);
}

const DIAGNOSTIC_LOG_LEVELS = {
	[MachineDiagnosticStatus.Ok]: 'ok',
	[MachineDiagnosticStatus.Pending]: 'pending',
	[MachineDiagnosticStatus.Failed]: 'error',
} as const satisfies Record<MachineDiagnosticStatus, string>;
const OPTIONAL_FAILURE_LOG_LEVEL = 'warn';
const LOG_FIELD_SEPARATOR = ' ';
const LOG_DETAIL_SEPARATOR = ' — ';
const LOG_FIX_PREFIX = '  fix: ';

function diagnosticLogLevel(check: MachineDiagnosticCheck): string {
	return check.status === MachineDiagnosticStatus.Failed && !check.required
		? OPTIONAL_FAILURE_LOG_LEVEL
		: DIAGNOSTIC_LOG_LEVELS[check.status];
}

export function diagnosticLogLines(
	checks: readonly MachineDiagnosticCheck[]
): string[] {
	return sortedDiagnostics(checks).flatMap((check) => {
		const head = [diagnosticLogLevel(check).toUpperCase(), check.name].join(
			LOG_FIELD_SEPARATOR
		);
		const line = check.detail
			? `${head}${LOG_DETAIL_SEPARATOR}${check.detail}`
			: head;
		return check.remediation && check.status !== MachineDiagnosticStatus.Ok
			? [line, `${LOG_FIX_PREFIX}${check.remediation}`]
			: [line];
	});
}

export function failedDiagnostics(
	checks: readonly MachineDiagnosticCheck[]
): number {
	return checks.filter(
		(check) => check.status === MachineDiagnosticStatus.Failed && check.required
	).length;
}

export interface LocalBenchmarkMetric {
	label: string;
	median: string;
	tail: string;
}

function tailCaption(
	distribution: MachineMeasurementDistribution,
	format: (value: number) => string
): string {
	return `p95 ${format(distribution.p95)} · p99 ${format(distribution.p99)}`;
}

export function localBenchmarkMetrics(
	benchmark: MachineLocalBenchmark
): LocalBenchmarkMetric[] {
	const entries = [
		{
			label: 'Storage write',
			distribution: benchmark.storageWriteBytesPerSecond,
			format: formatThroughput,
		},
		{
			label: 'Storage read',
			distribution: benchmark.storageReadBytesPerSecond,
			format: formatThroughput,
		},
		{
			label: 'API latency',
			distribution: benchmark.apiHealthLatencyNanos,
			format: formatNanoseconds,
		},
		{
			label: 'Release check',
			distribution: benchmark.releaseVerificationNanos,
			format: formatNanoseconds,
		},
	];
	return entries.map(({ label, distribution, format }) => ({
		label,
		median: format(distribution.p50),
		tail: tailCaption(distribution, format),
	}));
}
