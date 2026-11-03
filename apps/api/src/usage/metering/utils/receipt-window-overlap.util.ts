/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MachineUsageRuntimeState } from '../../../sandbox/machine/constants/machine-usage.constants';
import type { VerifiedMachineUsageReceipt } from './evidence/machine-usage-evidence.util';

export type ReceiptMeterEvidence = Pick<
	VerifiedMachineUsageReceipt,
	'intervalStartAt' | 'intervalStartState' | 'computeMillis' | 'storageMillis'
> & {
	reading: Pick<VerifiedMachineUsageReceipt['reading'], 'sampledAt' | 'state'>;
};

type MeterWindow = { startAt: Date; endAt: Date };

interface ReceiptWindowOverlap {
	computeMillis: bigint;
	storageMillis: bigint;
}

interface Span {
	startMillis: number;
	endMillis: number;
}

const NO_OVERLAP: ReceiptWindowOverlap = {
	computeMillis: 0n,
	storageMillis: 0n,
};

export function receiptWindowOverlap(
	receipt: ReceiptMeterEvidence,
	window: MeterWindow
): ReceiptWindowOverlap {
	const interval = {
		startMillis: receipt.intervalStartAt.getTime(),
		endMillis: receipt.reading.sampledAt.getTime(),
	};
	const intervalMillis = spanMillis(interval);
	if (intervalMillis <= 0) return NO_OVERLAP;
	const windowSpan = {
		startMillis: window.startAt.getTime(),
		endMillis: window.endAt.getTime(),
	};
	const intervalOverlapMillis = overlapMillis(interval, windowSpan);
	const { computeMillis } = receipt;
	const segment = runningSegment(receipt, interval, Number(computeMillis));
	return {
		computeMillis: segment
			? BigInt(overlapMillis(segment, windowSpan))
			: prorate(computeMillis, intervalOverlapMillis, intervalMillis),
		storageMillis: prorate(
			receipt.storageMillis,
			intervalOverlapMillis,
			intervalMillis
		),
	};
}

function runningSegment(
	receipt: ReceiptMeterEvidence,
	interval: Span,
	runningMillis: number
): Span | null {
	if (receipt.intervalStartState === MachineUsageRuntimeState.STARTED) {
		return {
			startMillis: interval.startMillis,
			endMillis: Math.min(
				interval.endMillis,
				interval.startMillis + runningMillis
			),
		};
	}
	if (
		receipt.intervalStartState !== MachineUsageRuntimeState.UNKNOWN &&
		receipt.reading.state === MachineUsageRuntimeState.STARTED
	) {
		return {
			startMillis: Math.max(
				interval.startMillis,
				interval.endMillis - runningMillis
			),
			endMillis: interval.endMillis,
		};
	}
	return null;
}

function prorate(
	deltaMillis: bigint,
	insideMillis: number,
	intervalMillis: number
): bigint {
	return (deltaMillis * BigInt(insideMillis)) / BigInt(intervalMillis);
}

function overlapMillis(left: Span, right: Span): number {
	return Math.max(
		0,
		Math.min(left.endMillis, right.endMillis) -
			Math.max(left.startMillis, right.startMillis)
	);
}

function spanMillis(span: Span): number {
	return span.endMillis - span.startMillis;
}
