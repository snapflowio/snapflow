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
import { millisecondsBetween } from '../../../common/utils/time.util';
import {
	MACHINE_IDENTITY_KEY_PREFIX,
	MACHINE_IDENTITY_KEY_TYPE,
	MACHINE_REGISTRATION_NONCE_MINIMUM_BYTES,
	MACHINE_REGISTRATION_NONCE_PATTERN,
	MACHINE_REGISTRATION_PROOF_CLOCK_SKEW_MILLISECONDS,
	MACHINE_REGISTRATION_PROOF_DOMAIN,
	MACHINE_REGISTRATION_SIGNATURE_BYTES,
	MACHINE_REGISTRATION_SIGNATURE_PATTERN,
} from '../constants/machine-registration.constants';

const PROOF_LINE_SEPARATOR = '\n';
const BASE64URL = 'base64url';

export interface MachineIdentity {
	publicKeyPem: string;
	keyId: string;
}

export interface MachineRegistrationProof {
	name: string;
	issuedAt: string;
	nonce: string;
	signature: string;
}

export function parseMachineIdentity(publicKeyPem: string): MachineIdentity {
	let key: ReturnType<typeof createPublicKey>;
	try {
		key = createPublicKey(publicKeyPem.trim());
	} catch (error) {
		throw new BadRequestException('Machine identity key is not a public key', {
			cause: error,
		});
	}
	if (key.asymmetricKeyType !== MACHINE_IDENTITY_KEY_TYPE) {
		throw new BadRequestException('Machine identity key must be Ed25519');
	}
	const digest = createHash('sha256')
		.update(key.export({ type: 'spki', format: 'der' }))
		.digest('hex');
	return {
		publicKeyPem: key.export({ type: 'spki', format: 'pem' }).toString(),
		keyId: `${MACHINE_IDENTITY_KEY_PREFIX}${digest}`,
	};
}

export function machineRegistrationProofMessage(
	identity: MachineIdentity,
	proof: Omit<MachineRegistrationProof, 'signature'>
): Buffer {
	return Buffer.from(
		[
			MACHINE_REGISTRATION_PROOF_DOMAIN,
			proof.name,
			identity.keyId,
			proof.issuedAt,
			proof.nonce,
		].join(PROOF_LINE_SEPARATOR)
	);
}

export function assertMachineRegistrationProof(
	identity: MachineIdentity,
	proof: MachineRegistrationProof,
	observedAt: Date
): void {
	const issuedAt = new Date(proof.issuedAt);
	if (
		!Number.isFinite(issuedAt.getTime()) ||
		Math.abs(millisecondsBetween(issuedAt, observedAt)) >
			MACHINE_REGISTRATION_PROOF_CLOCK_SKEW_MILLISECONDS ||
		!MACHINE_REGISTRATION_NONCE_PATTERN.test(proof.nonce) ||
		!MACHINE_REGISTRATION_SIGNATURE_PATTERN.test(proof.signature)
	) {
		throw new BadRequestException(
			'Machine registration proof is malformed or stale'
		);
	}
	const nonce = Buffer.from(proof.nonce, BASE64URL);
	const signature = Buffer.from(proof.signature, BASE64URL);
	if (
		nonce.length < MACHINE_REGISTRATION_NONCE_MINIMUM_BYTES ||
		nonce.toString(BASE64URL) !== proof.nonce ||
		signature.length !== MACHINE_REGISTRATION_SIGNATURE_BYTES ||
		signature.toString(BASE64URL) !== proof.signature ||
		!verify(
			null,
			machineRegistrationProofMessage(identity, proof),
			createPublicKey(identity.publicKeyPem),
			signature
		)
	) {
		throw new BadRequestException('Machine registration proof is invalid');
	}
}
