/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, createPublicKey, verify } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import {
	type Address,
	getAddress,
	type Hex,
	isAddressEqual,
	recoverMessageAddress,
	toHex,
} from 'viem';
import { apiError } from '../../common/utils/error/api-error.util';
import { millisecondsBetween } from '../../common/utils/time.util';
import {
	MACHINE_ENROLLMENT_PROOF_DOMAIN,
	MACHINE_IDENTITY_KEY_PREFIX,
	MACHINE_IDENTITY_KEY_TYPE,
	MACHINE_REGISTRATION_NONCE_MINIMUM_BYTES,
	MACHINE_REGISTRATION_NONCE_PATTERN,
	MACHINE_REGISTRATION_PROOF_CLOCK_SKEW_MILLISECONDS,
	MACHINE_REGISTRATION_SIGNATURE_BYTES,
	MACHINE_REGISTRATION_SIGNATURE_PATTERN,
} from '../constants/machine-registration.constants';
import { MachineApiErrorCode } from '../enums/machine-api-error-code.enum';

const PROOF_LINE_SEPARATOR = '\n';
const BASE64URL = 'base64url';

export interface MachineIdentity {
	publicKeyPem: string;
	keyId: string;
}

export interface MachineEnrollmentProof {
	name: string;
	hostAddress: Address;
	issuedAt: string;
	nonce: string;
	identitySignature: string;
	hostSignature: Hex;
}

export function parseMachineIdentity(publicKeyPem: string): MachineIdentity {
	let key: ReturnType<typeof createPublicKey>;
	try {
		key = createPublicKey(publicKeyPem.trim());
	} catch (error) {
		throw new BadRequestException(
			apiError(
				MachineApiErrorCode.IDENTITY_KEY_INVALID,
				'The machine identity key is not a valid public key. Send the Ed25519 public key of the machine.'
			),
			{
				cause: error,
			}
		);
	}
	if (key.asymmetricKeyType !== MACHINE_IDENTITY_KEY_TYPE) {
		throw new BadRequestException(
			apiError(
				MachineApiErrorCode.IDENTITY_KEY_INVALID,
				'The machine identity key must be an Ed25519 key. Send the Ed25519 public key of the machine.'
			)
		);
	}
	const digest = createHash('sha256')
		.update(key.export({ type: 'spki', format: 'der' }))
		.digest('hex');
	return {
		publicKeyPem: key.export({ type: 'spki', format: 'pem' }).toString(),
		keyId: `${MACHINE_IDENTITY_KEY_PREFIX}${digest}`,
	};
}

function machineEnrollmentProofMessage(
	identity: MachineIdentity,
	chainId: number,
	proof: Pick<
		MachineEnrollmentProof,
		'name' | 'hostAddress' | 'issuedAt' | 'nonce'
	>
): Buffer {
	return Buffer.from(
		[
			MACHINE_ENROLLMENT_PROOF_DOMAIN,
			proof.name,
			identity.keyId,
			getAddress(proof.hostAddress),
			String(chainId),
			proof.issuedAt,
			proof.nonce,
		].join(PROOF_LINE_SEPARATOR)
	);
}

export async function assertMachineEnrollmentProof(
	identity: MachineIdentity,
	chainId: number,
	proof: MachineEnrollmentProof,
	observedAt: Date
): Promise<void> {
	const issuedAt = new Date(proof.issuedAt);
	if (
		!Number.isFinite(issuedAt.getTime()) ||
		Math.abs(millisecondsBetween(issuedAt, observedAt)) >
			MACHINE_REGISTRATION_PROOF_CLOCK_SKEW_MILLISECONDS ||
		!MACHINE_REGISTRATION_NONCE_PATTERN.test(proof.nonce) ||
		!MACHINE_REGISTRATION_SIGNATURE_PATTERN.test(proof.identitySignature)
	) {
		throw new BadRequestException(
			apiError(
				MachineApiErrorCode.ENROLLMENT_PROOF_INVALID,
				'The enrollment proof is malformed or expired. Start the enrollment again.'
			)
		);
	}
	const message = machineEnrollmentProofMessage(identity, chainId, proof);
	const nonce = Buffer.from(proof.nonce, BASE64URL);
	const signature = Buffer.from(proof.identitySignature, BASE64URL);
	if (
		nonce.length < MACHINE_REGISTRATION_NONCE_MINIMUM_BYTES ||
		nonce.toString(BASE64URL) !== proof.nonce ||
		signature.length !== MACHINE_REGISTRATION_SIGNATURE_BYTES ||
		signature.toString(BASE64URL) !== proof.identitySignature ||
		!verify(null, message, createPublicKey(identity.publicKeyPem), signature)
	) {
		throw new BadRequestException(
			apiError(
				MachineApiErrorCode.ENROLLMENT_PROOF_INVALID,
				'The enrollment proof is not signed by the machine identity key. Start the enrollment again.'
			)
		);
	}
	if (!(await signedByHostKey(message, proof))) {
		throw new BadRequestException(
			apiError(
				MachineApiErrorCode.ENROLLMENT_PROOF_INVALID,
				'The enrollment proof is not signed by the host key. Start the enrollment again.'
			)
		);
	}
}

async function signedByHostKey(
	message: Buffer,
	proof: Pick<MachineEnrollmentProof, 'hostAddress' | 'hostSignature'>
): Promise<boolean> {
	try {
		const signer = await recoverMessageAddress({
			message: { raw: toHex(message) },
			signature: proof.hostSignature,
		});
		return isAddressEqual(signer, proof.hostAddress);
	} catch {
		return false;
	}
}
