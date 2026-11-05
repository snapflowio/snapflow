/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MACHINE_USAGE_GENESIS_DIGEST } from '../../../machine/constants/machine-usage.constants';
import { MachineUsageEvidenceError } from '../../../machine/exceptions/machine-usage-evidence.exception';
import {
	type MachineUsageReceiptEnvelope,
	machineUsageEnvelopeSchema,
} from '../../schemas/machine-usage-envelope.schema';
import {
	type MachineUsageInterval,
	type MachineUsageReading,
	machineUsageReading,
	meterMachineUsageInterval,
} from './machine-usage-meter.util';
import {
	machineUsagePayloadDigest,
	machineUsageSignatureIsValid,
} from './machine-usage-signature.util';

export interface SignedMachineUsageReading {
	signerPublicKey: string;
	envelope: unknown;
}

export interface VerifiedMachineUsageReading {
	signerPublicKey: string;
	payloadDigest: string;
	envelope: MachineUsageReceiptEnvelope;
	reading: MachineUsageReading;
}

export interface VerifiedMachineUsageReceipt
	extends MachineUsageInterval,
		VerifiedMachineUsageReading {
	predecessor: VerifiedMachineUsageReading | null;
}

export function verifyMachineUsageReceipt(
	machineId: string,
	receipt: SignedMachineUsageReading,
	predecessor: SignedMachineUsageReading | null
): VerifiedMachineUsageReceipt {
	const verified = verifySignedReading(machineId, receipt);
	const opener = predecessor && verifySignedReading(machineId, predecessor);
	assertLinked(verified, opener);
	return {
		...meterMachineUsageInterval(opener?.reading ?? null, verified.reading),
		...verified,
		predecessor: opener,
	};
}

function verifySignedReading(
	machineId: string,
	signed: SignedMachineUsageReading
): VerifiedMachineUsageReading {
	const parsed = machineUsageEnvelopeSchema.safeParse(signed.envelope);
	if (!parsed.success) {
		throw new MachineUsageEvidenceError('Usage reading envelope is malformed');
	}
	const envelope = parsed.data;
	if (!signatureVerifies(machineId, signed.signerPublicKey, envelope)) {
		throw new MachineUsageEvidenceError('Usage reading signature is invalid');
	}
	return {
		signerPublicKey: signed.signerPublicKey,
		payloadDigest: machineUsagePayloadDigest(machineId, envelope),
		envelope,
		reading: machineUsageReading(envelope),
	};
}

function signatureVerifies(
	machineId: string,
	signerPublicKey: string,
	envelope: MachineUsageReceiptEnvelope
): boolean {
	try {
		return machineUsageSignatureIsValid(machineId, signerPublicKey, envelope);
	} catch {
		return false;
	}
}

function assertLinked(
	receipt: VerifiedMachineUsageReading,
	predecessor: VerifiedMachineUsageReading | null
): void {
	const { envelope } = receipt;
	if (predecessor && !samePlacement(envelope, predecessor.envelope)) {
		throw new MachineUsageEvidenceError(
			'Usage reading predecessor belongs to another placement'
		);
	}
	if (envelope.previousDigest !== MACHINE_USAGE_GENESIS_DIGEST) {
		if (predecessor?.payloadDigest !== envelope.previousDigest) {
			throw new MachineUsageEvidenceError(
				'Usage reading does not extend its predecessor'
			);
		}
		return;
	}
	if (predecessor?.envelope.generationId === envelope.generationId) {
		throw new MachineUsageEvidenceError(
			'Usage reading restarts the chain of its runtime generation'
		);
	}
}

function samePlacement(
	left: MachineUsageReceiptEnvelope,
	right: MachineUsageReceiptEnvelope
): boolean {
	return (
		left.placementId === right.placementId &&
		left.sandboxId === right.sandboxId &&
		left.assignmentGeneration === right.assignmentGeneration &&
		left.fencingToken === right.fencingToken
	);
}
