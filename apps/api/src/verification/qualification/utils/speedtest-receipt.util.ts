/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
	SpeedtestDirection,
	type SpeedtestReceipt,
} from '@snapflow/machine-proto';
import { MICROSECONDS_PER_MILLISECOND } from '../../../common/constants/time.constants';
import {
	BENCHMARK_FAILURE,
	BENCHMARK_POLICY,
	BENCHMARK_PROTOCOL,
	type BenchmarkFailure,
} from '../constants/benchmark-policy.constants';
import type { EdgeIdentityKey } from '../types/benchmark.types';
import { verifyEd25519 } from './benchmark-signature.util';

const RECEIPT_FIELD_SEPARATOR = '\n';
const MEDIAN_PAIR_SIZE = 2;

const DIRECTION_NAME: Readonly<Record<SpeedtestDirection, string | null>> = {
	[SpeedtestDirection.UNSPECIFIED]: null,
	[SpeedtestDirection.DOWNLOAD]: 'download',
	[SpeedtestDirection.UPLOAD]: 'upload',
};

export interface SpeedtestWindow {
	tokens: readonly string[];
	notBefore: Date;
	notAfter: Date;
	minimumBytes: number;
}

export type ReceiptSpan = Pick<
	SpeedtestReceipt,
	| 'bytes'
	| 'measuredBytes'
	| 'minRttMicros'
	| 'smoothedRttMicros'
	| 'rttVarianceMicros'
	| 'retransmittedSegments'
	| 'sentSegments'
> & {
	startedAtMillis: number;
	finishedAtMillis: number;
	measuredStartedAtMillis: number;
};

function receiptSpan(receipt: SpeedtestReceipt): ReceiptSpan | null {
	if (!receipt.startedAt || !receipt.finishedAt || !receipt.measuredStartedAt) {
		return null;
	}
	return {
		bytes: receipt.bytes,
		startedAtMillis: timestampMs(receipt.startedAt),
		finishedAtMillis: timestampMs(receipt.finishedAt),
		measuredBytes: receipt.measuredBytes,
		measuredStartedAtMillis: timestampMs(receipt.measuredStartedAt),
		minRttMicros: receipt.minRttMicros,
		smoothedRttMicros: receipt.smoothedRttMicros,
		rttVarianceMicros: receipt.rttVarianceMicros,
		retransmittedSegments: receipt.retransmittedSegments,
		sentSegments: receipt.sentSegments,
	};
}

export function speedtestReceiptMessage(
	token: string,
	direction: string,
	span: ReceiptSpan
): Buffer {
	return Buffer.from(
		[
			BENCHMARK_PROTOCOL.SPEEDTEST_RECEIPT_DOMAIN,
			token,
			direction,
			span.bytes,
			span.startedAtMillis,
			span.finishedAtMillis,
			span.measuredBytes,
			span.measuredStartedAtMillis,
			span.minRttMicros,
			span.smoothedRttMicros,
			span.rttVarianceMicros,
			span.retransmittedSegments,
			span.sentSegments,
		].join(RECEIPT_FIELD_SEPARATOR),
		'utf8'
	);
}

export function verifySpeedtestReceipt(
	receipt: SpeedtestReceipt,
	window: SpeedtestWindow,
	edgeKeys: ReadonlyMap<string, EdgeIdentityKey>
): ReceiptSpan | null {
	const direction = DIRECTION_NAME[receipt.direction];
	const span = receiptSpan(receipt);
	const edgeKey = edgeKeys.get(receipt.edgeKeyId);
	if (!direction || !span || !edgeKey) return null;
	if (
		span.bytes < BigInt(window.minimumBytes) ||
		span.finishedAtMillis <= span.startedAtMillis ||
		span.startedAtMillis < window.notBefore.getTime() ||
		span.finishedAtMillis > window.notAfter.getTime()
	) {
		return null;
	}
	const signed = window.tokens.some((token) =>
		verifyEd25519(
			edgeKey.publicKeyPem,
			speedtestReceiptMessage(token, direction, span),
			receipt.signature
		)
	);
	return signed ? span : null;
}

export function throughputMbps(spans: readonly ReceiptSpan[]): number | null {
	const bytes = spans.reduce((total, span) => total + span.measuredBytes, 0n);
	const startedAt = Math.min(
		...spans.map((span) => span.measuredStartedAtMillis)
	);
	const finishedAt = Math.max(...spans.map((span) => span.finishedAtMillis));
	if (bytes === 0n || finishedAt <= startedAt) return null;
	return Number(
		(bytes * BigInt(BENCHMARK_POLICY.BITS_PER_BYTE)) /
			BigInt(
				(finishedAt - startedAt) *
					BENCHMARK_POLICY.BITS_PER_MEGABIT_PER_MILLISECOND
			)
	);
}

function median(values: readonly number[]): number {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / MEDIAN_PAIR_SIZE);
	return sorted.length % MEDIAN_PAIR_SIZE === 0
		? (sorted[middle - 1] + sorted[middle]) / MEDIAN_PAIR_SIZE
		: sorted[middle];
}

export interface SpeedtestLatency {
	minRttMs: number;
	loadedRttMs: number;
	jitterMs: number;
}

export function speedtestLatency(
	spans: readonly ReceiptSpan[]
): SpeedtestLatency {
	return {
		minRttMs:
			Math.min(...spans.map((span) => span.minRttMicros)) /
			MICROSECONDS_PER_MILLISECOND,
		loadedRttMs:
			median(spans.map((span) => span.smoothedRttMicros)) /
			MICROSECONDS_PER_MILLISECOND,
		jitterMs:
			median(spans.map((span) => span.rttVarianceMicros)) /
			MICROSECONDS_PER_MILLISECOND,
	};
}

export interface SpeedtestResult extends SpeedtestLatency {
	downlinkMbps: number;
	uplinkMbps: number;
}

export type SpeedtestVerification =
	| { verified: true; result: SpeedtestResult }
	| { verified: false; failure: BenchmarkFailure };

export function verifySpeedtests(
	receipts: readonly SpeedtestReceipt[],
	window: SpeedtestWindow,
	edgeKeys: ReadonlyMap<string, EdgeIdentityKey>
): SpeedtestVerification {
	const downloads: ReceiptSpan[] = [];
	const uploads: ReceiptSpan[] = [];
	for (const receipt of receipts) {
		const span = verifySpeedtestReceipt(receipt, window, edgeKeys);
		if (!span) {
			return { verified: false, failure: BENCHMARK_FAILURE.SPEEDTEST_INVALID };
		}
		(receipt.direction === SpeedtestDirection.DOWNLOAD
			? downloads
			: uploads
		).push(span);
	}
	const downlinkMbps = throughputMbps(downloads);
	const uplinkMbps = throughputMbps(uploads);
	if (downlinkMbps === null || uplinkMbps === null) {
		return { verified: false, failure: BENCHMARK_FAILURE.SPEEDTEST_MISSING };
	}
	return {
		verified: true,
		result: {
			downlinkMbps,
			uplinkMbps,
			...speedtestLatency([...downloads, ...uploads]),
		},
	};
}
