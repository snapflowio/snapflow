/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	PriceTerms,
	UsageQuantities,
} from '../../../marketplace/types/pricing.types';
import type { SandboxBillableUsage } from '../../../usage/entities/sandbox-billable-usage.entity';
import type { VerifiedMachineUsageReceipt } from '../../../usage/utils/evidence/machine-usage-evidence.util';
import { receiptWindowOverlap } from '../../../usage/utils/receipt-window-overlap.util';
import {
	type AllocationUnits,
	allocationUnits,
	attestedQuantities,
	parseAllocation,
	parseQuantityColumns,
} from '../../../usage/utils/usage-quantities.util';
import {
	type AttestedCharge,
	attestedCharge,
} from './billing-attestation.util';

export type AttestationWindow = Pick<
	SandboxBillableUsage,
	| 'startAt'
	| 'endAt'
	| 'durationMillis'
	| 'cpu'
	| 'memoryGiB'
	| 'diskGiB'
	| 'gpu'
	| 'vcpuMillis'
	| 'memoryGibMillis'
	| 'gpuMillis'
	| 'runningDiskGibMillis'
	| 'stoppedDiskGibMillis'
	| 'runningMillis'
>;

export interface UsageAttestation extends AttestedCharge {
	computeMillis: bigint;
	storageMillis: bigint;
	receiptCount: number;
	attestedQuantities: UsageQuantities;
}

export function attestUsageWindow(
	window: AttestationWindow,
	terms: PriceTerms,
	receipts: readonly VerifiedMachineUsageReceipt[]
): UsageAttestation {
	const durationMillis = BigInt(window.durationMillis);
	const allocation = parseAllocation(window);
	let computeMillis = 0n;
	let storageMillis = 0n;
	let receiptCount = 0;
	for (const receipt of receipts) {
		if (!metersWindowAllocation(allocation, receipt)) continue;
		const overlap = receiptWindowOverlap(receipt, window);
		computeMillis += overlap.computeMillis;
		storageMillis += overlap.storageMillis;
		receiptCount += 1;
	}
	const elapsedMillis = BigInt(
		window.endAt.getTime() - window.startAt.getTime()
	);
	const minimumTopUp =
		durationMillis > elapsedMillis ? durationMillis - elapsedMillis : 0n;
	computeMillis = storesDiskOnly(allocation)
		? 0n
		: minimum(computeMillis, elapsedMillis);
	storageMillis = minimum(storageMillis, elapsedMillis);
	if (computeMillis > 0n) {
		computeMillis += minimumTopUp;
		storageMillis += minimumTopUp;
	}
	const attested = attestedQuantities(allocation, computeMillis, storageMillis);
	return {
		computeMillis,
		storageMillis,
		receiptCount,
		attestedQuantities: attested,
		...attestedCharge(terms, parseQuantityColumns(window), attested),
	};
}

function metersWindowAllocation(
	allocation: AllocationUnits,
	receipt: VerifiedMachineUsageReceipt
): boolean {
	const { envelope } = receipt;
	if (
		receipt.intervalStartAt >= receipt.reading.sampledAt ||
		allocation.diskGiB !== allocationUnits(envelope.diskGiB, 'disk')
	) {
		return false;
	}
	return (
		storesDiskOnly(allocation) ||
		(allocation.cpu === allocationUnits(envelope.cpu, 'CPU') &&
			allocation.memoryGiB === allocationUnits(envelope.memoryGiB, 'memory') &&
			allocation.gpu === allocationUnits(envelope.gpu, 'GPU'))
	);
}

function storesDiskOnly(allocation: AllocationUnits): boolean {
	return (
		allocation.cpu === 0n &&
		allocation.memoryGiB === 0n &&
		allocation.gpu === 0n
	);
}

function minimum(left: bigint, right: bigint): bigint {
	return left < right ? left : right;
}
