/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { millisecondsBetween } from '../../../../common/utils/time.util';
import {
	MACHINE_NETWORK_COUNTERS,
	type MachineNetworkBytes,
	type MachineUsageRuntimeState,
} from '../../../../sandbox/machine/constants/machine-usage.constants';
import { MachineUsageEvidenceError } from '../../../../sandbox/machine/exceptions/machine-usage-evidence.exception';
import type { MachineUsageReceiptEnvelope } from '../../schemas/machine-usage-envelope.schema';

export interface MachineUsageReading {
	generationId: string;
	sequence: bigint;
	sampledAt: Date;
	state: MachineUsageRuntimeState;
	runningMillis: bigint;
	network: MachineNetworkBytes;
}

export interface MachineUsageInterval {
	intervalStartAt: Date;
	intervalStartState: MachineUsageRuntimeState;
	computeMillis: bigint;
	storageMillis: bigint;
	networkDeltas: MachineNetworkBytes;
}

export function machineUsageReading(
	envelope: MachineUsageReceiptEnvelope
): MachineUsageReading {
	const sampledAt = new Date(envelope.sampledAt);
	if (!Number.isFinite(sampledAt.getTime())) {
		throw new MachineUsageEvidenceError('Usage reading sample time is invalid');
	}
	const sequence = BigInt(envelope.sequence);
	if (sequence === 0n) {
		throw new MachineUsageEvidenceError(
			'Usage reading sequence must be positive'
		);
	}
	return {
		generationId: envelope.generationId,
		sequence,
		sampledAt,
		state: envelope.state,
		runningMillis: BigInt(envelope.runningMillis),
		network: networkCounters(envelope),
	};
}

export function meterMachineUsageInterval(
	predecessor: MachineUsageReading | null,
	reading: MachineUsageReading
): MachineUsageInterval {
	if (!predecessor) {
		return {
			intervalStartAt: reading.sampledAt,
			intervalStartState: reading.state,
			computeMillis: 0n,
			storageMillis: 0n,
			networkDeltas: reading.network,
		};
	}
	if (reading.sequence <= predecessor.sequence) {
		throw new MachineUsageEvidenceError(
			'Usage reading sequence is not monotonic'
		);
	}
	if (reading.sampledAt <= predecessor.sampledAt) {
		throw new MachineUsageEvidenceError(
			'Usage reading sample time is not monotonic'
		);
	}
	const intervalMillis = BigInt(
		millisecondsBetween(predecessor.sampledAt, reading.sampledAt)
	);
	const sameGeneration = predecessor.generationId === reading.generationId;
	if (sameGeneration && !countersAdvance(predecessor, reading)) {
		throw new MachineUsageEvidenceError(
			'Usage reading counters are not monotonic'
		);
	}
	const runningDelta = sameGeneration
		? reading.runningMillis - predecessor.runningMillis
		: 0n;
	return {
		intervalStartAt: predecessor.sampledAt,
		intervalStartState: predecessor.state,
		computeMillis: minimum(intervalMillis, runningDelta),
		storageMillis: intervalMillis,
		networkDeltas: sameGeneration
			? networkDifference(reading.network, predecessor.network)
			: reading.network,
	};
}

function countersAdvance(
	predecessor: MachineUsageReading,
	reading: MachineUsageReading
): boolean {
	return (
		reading.runningMillis >= predecessor.runningMillis &&
		MACHINE_NETWORK_COUNTERS.every(
			(counter) => reading.network[counter] >= predecessor.network[counter]
		)
	);
}

function networkCounters(
	envelope: MachineUsageReceiptEnvelope
): MachineNetworkBytes {
	return {
		internetEgressBytes: BigInt(envelope.internetEgressBytes),
		internetIngressBytes: BigInt(envelope.internetIngressBytes),
		hostEgressBytes: BigInt(envelope.hostEgressBytes),
		hostIngressBytes: BigInt(envelope.hostIngressBytes),
		tapEgressBytes: BigInt(envelope.tapEgressBytes),
		tapIngressBytes: BigInt(envelope.tapIngressBytes),
	};
}

function networkDifference(
	current: MachineNetworkBytes,
	previous: MachineNetworkBytes
): MachineNetworkBytes {
	return {
		internetEgressBytes:
			current.internetEgressBytes - previous.internetEgressBytes,
		internetIngressBytes:
			current.internetIngressBytes - previous.internetIngressBytes,
		hostEgressBytes: current.hostEgressBytes - previous.hostEgressBytes,
		hostIngressBytes: current.hostIngressBytes - previous.hostIngressBytes,
		tapEgressBytes: current.tapEgressBytes - previous.tapEgressBytes,
		tapIngressBytes: current.tapIngressBytes - previous.tapIngressBytes,
	};
}

function minimum(left: bigint, right: bigint): bigint {
	return left < right ? left : right;
}
