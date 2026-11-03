/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import type { MachineUsageReceiptEnvelope } from '../../../usage/metering/schemas/machine-usage-envelope.schema';
import {
	machineUsagePayloadDigest,
	machineUsageSignaturePayload,
} from '../../../usage/metering/utils/evidence/machine-usage-signature.util';
import {
	MACHINE_USAGE_GENESIS_DIGEST,
	type MachineNetworkBytes,
	type MachineNetworkCounter,
	MachineUsageRuntimeState,
} from '../constants/machine-usage.constants';

const keys = generateKeyPairSync('ed25519');

export const USAGE_MACHINE_ID = '4b8f2c1e-6d3a-4e5b-9c7d-0a1b2c3d4e5f';
export const USAGE_SIGNER_PUBLIC_KEY = keys.publicKey
	.export({ type: 'spki', format: 'pem' })
	.toString();
const USAGE_GENERATION_ID = '9d0c4c56-3c0b-4a5f-8f0e-0d6f1f3b2a10';
export const USAGE_PLACEMENT = {
	placementId: '1f2e3d4c-5b6a-4789-8a9b-0c1d2e3f4a5b',
	sandboxId: 'sandbox-usage-test',
	assignmentGeneration: 1,
	fencingToken: '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d',
} as const;
export const USAGE_ALLOCATION = { cpu: 1, memoryGiB: 1, diskGiB: 1, gpu: 0 };

type UnsignedEnvelope = Omit<MachineUsageReceiptEnvelope, 'signature'>;

export function signUsageEnvelope(
	unsigned: UnsignedEnvelope
): MachineUsageReceiptEnvelope {
	const envelope = { ...unsigned, signature: '' };
	return {
		...envelope,
		signature: sign(
			null,
			Buffer.from(machineUsageSignaturePayload(USAGE_MACHINE_ID, envelope)),
			keys.privateKey
		).toString('base64url'),
	};
}

export interface UsageReadingSpec {
	sampledAt: Date;
	runningMillis: number;
	state?: MachineUsageRuntimeState;
	generationId?: string;
	allocation?: Partial<typeof USAGE_ALLOCATION>;
	network?: Partial<MachineNetworkBytes>;
}

const NO_NETWORK_BYTES: MachineNetworkBytes = {
	internetEgressBytes: 0n,
	internetIngressBytes: 0n,
	hostEgressBytes: 0n,
	hostIngressBytes: 0n,
	tapEgressBytes: 0n,
	tapIngressBytes: 0n,
};

function networkFields(
	network: Partial<MachineNetworkBytes> = {}
): Record<MachineNetworkCounter, string> {
	const counters = { ...NO_NETWORK_BYTES, ...network };
	return {
		internetEgressBytes: counters.internetEgressBytes.toString(),
		internetIngressBytes: counters.internetIngressBytes.toString(),
		hostEgressBytes: counters.hostEgressBytes.toString(),
		hostIngressBytes: counters.hostIngressBytes.toString(),
		tapEgressBytes: counters.tapEgressBytes.toString(),
		tapIngressBytes: counters.tapIngressBytes.toString(),
	};
}

export interface SignedUsageReceipt {
	id: string;
	signerPublicKey: string;
	payloadDigest: string;
	envelope: MachineUsageReceiptEnvelope;
	predecessor: SignedUsageReceipt | null;
}

export function signedUsageChain(
	specs: readonly UsageReadingSpec[]
): SignedUsageReceipt[] {
	const heads = new Map<string, string>();
	const chain: SignedUsageReceipt[] = [];
	specs.forEach((spec, index) => {
		const generationId = spec.generationId ?? USAGE_GENERATION_ID;
		const envelope = signUsageEnvelope({
			...USAGE_PLACEMENT,
			...USAGE_ALLOCATION,
			...spec.allocation,
			generationId,
			sequence: (index + 1).toString(),
			previousDigest: heads.get(generationId) ?? MACHINE_USAGE_GENESIS_DIGEST,
			sampledAt: spec.sampledAt.toISOString(),
			state: spec.state ?? MachineUsageRuntimeState.STARTED,
			runningMillis: spec.runningMillis.toString(),
			...networkFields(spec.network),
		});
		const payloadDigest = machineUsagePayloadDigest(USAGE_MACHINE_ID, envelope);
		heads.set(generationId, payloadDigest);
		chain.push({
			id: randomUUID(),
			signerPublicKey: USAGE_SIGNER_PUBLIC_KEY,
			payloadDigest,
			envelope,
			predecessor: chain.at(-1) ?? null,
		});
	});
	return chain;
}
