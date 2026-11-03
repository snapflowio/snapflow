/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { v4 } from 'uuid';
import type { VerifiedMachineUsageReceipt } from '../../../../usage/metering/utils/evidence/machine-usage-evidence.util';
import type { SandboxPlacement } from '../../../instance/entities/sandbox-placement.entity';
import { MACHINE_NETWORK_COUNTERS } from '../../constants/machine-usage.constants';
import type { MachineUsageReceiptDto } from '../../dto/machine-usage.dto';
import { MachineUsageReceipt } from '../../entities/machine-usage-receipt.entity';
import type { ClampedNetworkDeltas } from './machine-network-clamp.util';

export interface MachineUsageReceiptParts {
	machineId: string;
	sessionId: string;
	placement: SandboxPlacement;
	input: MachineUsageReceiptDto;
	predecessor: MachineUsageReceipt | null;
	verified: VerifiedMachineUsageReceipt;
	network: ClampedNetworkDeltas;
	signerPublicKey: string;
	receivedAt: Date;
}

export function machineUsageReceipt(
	parts: MachineUsageReceiptParts
): MachineUsageReceipt {
	const { placement, input, verified, network } = parts;
	const receipt = new MachineUsageReceipt();
	receipt.id = v4();
	receipt.machineId = parts.machineId;
	receipt.sessionId = parts.sessionId;
	receipt.placementId = placement.id;
	receipt.sandboxId = placement.sandboxId;
	receipt.assignmentGeneration = placement.assignmentGeneration;
	receipt.fencingToken = placement.fencingToken;
	receipt.generationId = verified.reading.generationId;
	receipt.sequence = verified.reading.sequence.toString();
	receipt.previousDigest = input.previousDigest;
	receipt.predecessorId = parts.predecessor?.id ?? null;
	receipt.sampledAt = verified.reading.sampledAt;
	receipt.intervalStartAt = verified.intervalStartAt;
	receipt.intervalStartState = verified.intervalStartState;
	receipt.state = verified.reading.state;
	receipt.runningMillis = verified.reading.runningMillis.toString();
	for (const counter of MACHINE_NETWORK_COUNTERS) {
		receipt[counter] = verified.reading.network[counter].toString();
	}
	receipt.acceptedInternetEgressDeltaBytes =
		network.acceptedInternetEgressBytes.toString();
	receipt.acceptedInternetIngressDeltaBytes =
		network.acceptedInternetIngressBytes.toString();
	receipt.clampedInternetEgressBytes =
		network.clampedInternetEgressBytes.toString();
	receipt.clampedInternetIngressBytes =
		network.clampedInternetIngressBytes.toString();
	receipt.hostEgressDeltaBytes =
		verified.networkDeltas.hostEgressBytes.toString();
	receipt.hostIngressDeltaBytes =
		verified.networkDeltas.hostIngressBytes.toString();
	receipt.cpu = input.cpu;
	receipt.memoryGiB = input.memoryGiB;
	receipt.diskGiB = input.diskGiB;
	receipt.gpu = input.gpu;
	receipt.acceptedComputeDeltaMillis = verified.computeMillis.toString();
	receipt.acceptedStorageDeltaMillis = verified.storageMillis.toString();
	receipt.payloadDigest = verified.payloadDigest;
	receipt.signature = input.signature;
	receipt.signerPublicKey = parts.signerPublicKey;
	receipt.envelope = verified.envelope;
	receipt.receivedAt = parts.receivedAt;
	return receipt;
}
