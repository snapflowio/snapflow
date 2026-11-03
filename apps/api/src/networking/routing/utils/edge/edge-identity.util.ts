/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createHash,
	createPublicKey,
	timingSafeEqual,
	verify,
} from 'node:crypto';
import { millisecondsBetween } from '../../../../common/utils/time.util';
import { EDGE_IDENTITY } from '../../constants/edge.constants';

const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export function hashEdgeSecret(value: string): string {
	return createHash(EDGE_IDENTITY.hashAlgorithm).update(value).digest('hex');
}

export function edgeSecretsMatch(
	candidate: string,
	expectedHash: string
): boolean {
	const candidateHash = Buffer.from(hashEdgeSecret(candidate), 'hex');
	const expected = Buffer.from(expectedHash, 'hex');
	return (
		candidateHash.length === expected.length &&
		timingSafeEqual(candidateHash, expected)
	);
}

export function canonicalizeEdgeIdentity(
	publicKeyPem: string,
	expectedKeyId: string
): string {
	const key = createPublicKey(publicKeyPem.trim());
	if (key.asymmetricKeyType !== 'ed25519') {
		throw new Error('Identity key must be Ed25519');
	}
	const digest = createHash(EDGE_IDENTITY.hashAlgorithm)
		.update(key.export({ type: 'spki', format: 'der' }))
		.digest('hex');
	if (`${EDGE_IDENTITY.keyIdPrefix}${digest}` !== expectedKeyId) {
		throw new Error('Identity key ID does not match public key');
	}
	return key.export({ type: 'spki', format: 'pem' }).toString();
}

export function verifyEdgeIdentityProof(input: {
	identityPublicKey: string;
	issuedAt: string;
	nonce: string;
	signature: string;
	payload: readonly string[];
	observedAt: Date;
}): Date {
	const issuedAt = new Date(input.issuedAt);
	if (
		!Number.isFinite(issuedAt.getTime()) ||
		Math.abs(millisecondsBetween(issuedAt, input.observedAt)) >
			EDGE_IDENTITY.proofClockSkewMilliseconds
	) {
		throw new Error('Identity proof is outside the allowed time window');
	}
	if (
		!BASE64_URL_PATTERN.test(input.nonce) ||
		input.signature.length !== EDGE_IDENTITY.base64UrlEd25519SignatureLength ||
		!BASE64_URL_PATTERN.test(input.signature)
	) {
		throw new Error('Identity proof encoding is invalid');
	}

	const nonce = Buffer.from(input.nonce, 'base64url');
	const signature = Buffer.from(input.signature, 'base64url');
	if (
		nonce.length < EDGE_IDENTITY.minimumProofNonceBytes ||
		signature.length !== EDGE_IDENTITY.signatureBytes ||
		nonce.toString('base64url') !== input.nonce ||
		signature.toString('base64url') !== input.signature
	) {
		throw new Error('Identity proof is malformed');
	}

	const payload = [...input.payload, input.issuedAt, input.nonce].join('\n');
	if (
		!verify(
			null,
			Buffer.from(payload, 'utf8'),
			createPublicKey(input.identityPublicKey),
			signature
		)
	) {
		throw new Error('Identity proof signature is invalid');
	}
	return issuedAt;
}
