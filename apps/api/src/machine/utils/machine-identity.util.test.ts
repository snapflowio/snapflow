/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import {
	createHash,
	generateKeyPairSync,
	randomBytes,
	sign,
} from 'node:crypto';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
	MACHINE_IDENTITY_KEY_PREFIX,
	MACHINE_REGISTRATION_NONCE_MINIMUM_BYTES,
	MACHINE_REGISTRATION_PROOF_CLOCK_SKEW_MILLISECONDS,
} from '../constants/machine-registration.constants';
import {
	assertMachineRegistrationProof,
	type MachineRegistrationProof,
	machineRegistrationProofMessage,
	parseMachineIdentity,
} from './machine-identity.util';

const MACHINE_NAME = 'garage-4090';
const OTHER_MACHINE_NAME = 'garage-5090';
const OBSERVED_AT = new Date('2026-10-13T12:00:00.000Z');

function identityKeys() {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	return {
		privateKey,
		publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
		keyId: `${MACHINE_IDENTITY_KEY_PREFIX}${createHash('sha256')
			.update(publicKey.export({ type: 'spki', format: 'der' }))
			.digest('hex')}`,
	};
}

function signedProof(
	keys: ReturnType<typeof identityKeys>,
	overrides: Partial<MachineRegistrationProof> = {}
): MachineRegistrationProof {
	const unsigned = {
		name: MACHINE_NAME,
		issuedAt: OBSERVED_AT.toISOString(),
		nonce: randomBytes(MACHINE_REGISTRATION_NONCE_MINIMUM_BYTES).toString(
			'base64url'
		),
		...overrides,
	};
	const signature = sign(
		null,
		machineRegistrationProofMessage(
			parseMachineIdentity(keys.publicKeyPem),
			unsigned
		),
		keys.privateKey
	).toString('base64url');
	return { ...unsigned, signature };
}

describe('parseMachineIdentity', () => {
	it('derives the identity key id from the Ed25519 public key', () => {
		const keys = identityKeys();

		assert.equal(parseMachineIdentity(keys.publicKeyPem).keyId, keys.keyId);
	});

	it('rejects keys that are not Ed25519 public keys', () => {
		const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
			.publicKey.export({ type: 'spki', format: 'pem' })
			.toString();

		assert.throws(() => parseMachineIdentity(rsa), BadRequestException);
		assert.throws(() => parseMachineIdentity('not a key'), BadRequestException);
	});
});

describe('assertMachineRegistrationProof', () => {
	it('accepts a fresh proof signed by the identity key', () => {
		const keys = identityKeys();

		assert.doesNotThrow(() =>
			assertMachineRegistrationProof(
				parseMachineIdentity(keys.publicKeyPem),
				signedProof(keys),
				OBSERVED_AT
			)
		);
	});

	it('rejects a proof signed by another key', () => {
		const keys = identityKeys();

		assert.throws(
			() =>
				assertMachineRegistrationProof(
					parseMachineIdentity(keys.publicKeyPem),
					signedProof(identityKeys()),
					OBSERVED_AT
				),
			BadRequestException
		);
	});

	it('binds the proof to the requested name', () => {
		const keys = identityKeys();
		const proof = signedProof(keys);

		assert.throws(
			() =>
				assertMachineRegistrationProof(
					parseMachineIdentity(keys.publicKeyPem),
					{ ...proof, name: OTHER_MACHINE_NAME },
					OBSERVED_AT
				),
			BadRequestException
		);
	});

	it('rejects stale proofs', () => {
		const keys = identityKeys();
		const issuedAt = new Date(
			OBSERVED_AT.getTime() -
				MACHINE_REGISTRATION_PROOF_CLOCK_SKEW_MILLISECONDS -
				1
		).toISOString();

		assert.throws(
			() =>
				assertMachineRegistrationProof(
					parseMachineIdentity(keys.publicKeyPem),
					signedProof(keys, { issuedAt }),
					OBSERVED_AT
				),
			BadRequestException
		);
	});

	it('rejects short nonces', () => {
		const keys = identityKeys();

		assert.throws(
			() =>
				assertMachineRegistrationProof(
					parseMachineIdentity(keys.publicKeyPem),
					signedProof(keys, { nonce: 'c2hvcnQ' }),
					OBSERVED_AT
				),
			BadRequestException
		);
	});
});
