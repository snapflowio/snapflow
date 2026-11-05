/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, createPublicKey, verify } from 'node:crypto';
import { MACHINE_USAGE_SIGNATURE_DOMAIN } from '../../../sandbox/machine/constants/machine-usage.constants';
import type { MachineUsageReceiptEnvelope } from '../../schemas/machine-usage-envelope.schema';

const ED25519_SIGNATURE_BYTES = 64;
const ED25519_BASE64URL_LENGTH = 86;

export function machineUsageSignaturePayload(
	machineId: string,
	input: MachineUsageReceiptEnvelope
): string {
	return frameSignatureFields([
		MACHINE_USAGE_SIGNATURE_DOMAIN,
		machineId,
		input.placementId,
		input.sandboxId,
		input.assignmentGeneration.toString(),
		input.fencingToken,
		input.generationId,
		input.sequence,
		input.previousDigest,
		input.sampledAt,
		input.state,
		input.runningMillis,
		input.internetEgressBytes,
		input.internetIngressBytes,
		input.hostEgressBytes,
		input.hostIngressBytes,
		input.tapEgressBytes,
		input.tapIngressBytes,
		input.cpu.toString(),
		input.memoryGiB.toString(),
		input.diskGiB.toString(),
		input.gpu.toString(),
	]);
}

export function machineUsagePayloadDigest(
	machineId: string,
	input: MachineUsageReceiptEnvelope
): string {
	return createHash('sha256')
		.update(machineUsageSignaturePayload(machineId, input))
		.digest('hex');
}

export function machineUsageSignatureIsValid(
	machineId: string,
	publicKey: string,
	input: MachineUsageReceiptEnvelope
): boolean {
	if (input.signature.length !== ED25519_BASE64URL_LENGTH) return false;
	const signature = Buffer.from(input.signature, 'base64url');
	return (
		signature.length === ED25519_SIGNATURE_BYTES &&
		signature.toString('base64url') === input.signature &&
		verify(
			null,
			Buffer.from(machineUsageSignaturePayload(machineId, input)),
			createPublicKey(publicKey),
			signature
		)
	);
}

function frameSignatureFields(fields: readonly string[]): string {
	return fields
		.map((field) => `${Buffer.byteLength(field, 'utf8')}:${field}`)
		.join('');
}
