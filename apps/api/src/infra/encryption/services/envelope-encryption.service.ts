/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
	ENCRYPTION_ALGORITHM,
	ENCRYPTION_ENCODING,
	ENCRYPTION_ENVELOPE_VERSION,
	ENCRYPTION_KEY_BYTES,
	ENCRYPTION_NONCE_BYTES,
} from '../constants/encryption.constants';
import {
	type EncryptedEnvelope,
	type EncryptionContext,
	encryptedEnvelopeSchema,
} from '../schemas/encryption.schema';
import { encryptionContextBytes } from '../utils/encryption-context.util';
import { KeyEncryptionKeyService } from './key-encryption-key.service';

@Injectable()
export class EnvelopeEncryptionService {
	constructor(private readonly keyEncryptionKeys: KeyEncryptionKeyService) {}

	encrypt(plaintext: Uint8Array, context: EncryptionContext): string {
		const dataKey = randomBytes(ENCRYPTION_KEY_BYTES);
		const nonce = randomBytes(ENCRYPTION_NONCE_BYTES);
		const authenticatedContext = encryptionContextBytes(context);
		try {
			const cipher = createCipheriv(ENCRYPTION_ALGORITHM, dataKey, nonce);
			cipher.setAAD(authenticatedContext);
			const wrappedKey = this.keyEncryptionKeys.wrap(dataKey, context);
			const envelope = {
				version: ENCRYPTION_ENVELOPE_VERSION,
				keyId: wrappedKey.keyId,
				wrappedDataKey: wrappedKey.ciphertext,
				wrappedDataKeyNonce: wrappedKey.nonce,
				wrappedDataKeyAuthTag: wrappedKey.authTag,
				ciphertext: Buffer.concat([
					cipher.update(plaintext),
					cipher.final(),
				]).toString(ENCRYPTION_ENCODING),
				nonce: nonce.toString(ENCRYPTION_ENCODING),
				authTag: cipher.getAuthTag().toString(ENCRYPTION_ENCODING),
			} satisfies EncryptedEnvelope;
			return JSON.stringify(envelope);
		} finally {
			dataKey.fill(0);
			nonce.fill(0);
			authenticatedContext.fill(0);
		}
	}

	decrypt(serializedEnvelope: string, context: EncryptionContext): Buffer {
		const envelope = encryptedEnvelopeSchema.parse(
			JSON.parse(serializedEnvelope)
		);
		const dataKey = this.keyEncryptionKeys.unwrap(
			{
				keyId: envelope.keyId,
				ciphertext: envelope.wrappedDataKey,
				nonce: envelope.wrappedDataKeyNonce,
				authTag: envelope.wrappedDataKeyAuthTag,
			},
			context
		);
		const nonce = Buffer.from(envelope.nonce, ENCRYPTION_ENCODING);
		const authTag = Buffer.from(envelope.authTag, ENCRYPTION_ENCODING);
		const ciphertext = Buffer.from(envelope.ciphertext, ENCRYPTION_ENCODING);
		const authenticatedContext = encryptionContextBytes(context);
		try {
			const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, dataKey, nonce);
			decipher.setAAD(authenticatedContext);
			decipher.setAuthTag(authTag);
			return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
		} finally {
			dataKey.fill(0);
			nonce.fill(0);
			authTag.fill(0);
			ciphertext.fill(0);
			authenticatedContext.fill(0);
		}
	}

	rewrap(serializedEnvelope: string, context: EncryptionContext): string {
		const envelope = encryptedEnvelopeSchema.parse(
			JSON.parse(serializedEnvelope)
		);
		const dataKey = this.keyEncryptionKeys.unwrap(
			{
				keyId: envelope.keyId,
				ciphertext: envelope.wrappedDataKey,
				nonce: envelope.wrappedDataKeyNonce,
				authTag: envelope.wrappedDataKeyAuthTag,
			},
			context
		);
		try {
			const wrappedKey = this.keyEncryptionKeys.wrap(dataKey, context);
			return JSON.stringify({
				...envelope,
				keyId: wrappedKey.keyId,
				wrappedDataKey: wrappedKey.ciphertext,
				wrappedDataKeyNonce: wrappedKey.nonce,
				wrappedDataKeyAuthTag: wrappedKey.authTag,
			} satisfies EncryptedEnvelope);
		} finally {
			dataKey.fill(0);
		}
	}
}
