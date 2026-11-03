/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	timingSafeEqual,
} from 'node:crypto';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
	ENCRYPTION_ALGORITHM,
	ENCRYPTION_ENCODING,
	ENCRYPTION_NONCE_BYTES,
} from '../constants/encryption.constants';
import { KEYRINGS, type Keyrings } from '../providers/vault-keyrings.provider';
import type {
	EncryptionContext,
	WrappedDataKey,
} from '../schemas/encryption.schema';
import { wrappedKeyContextBytes } from '../utils/encryption-context.util';
import { keyringBuffers } from '../utils/keyring.util';

@Injectable()
export class KeyEncryptionKeyService implements OnModuleDestroy {
	private readonly currentId: string;
	private readonly keys: Map<string, Buffer>;

	constructor(@Inject(KEYRINGS) { encryption }: Keyrings) {
		this.currentId = encryption.currentKeyId;
		this.keys = keyringBuffers(encryption);
	}

	currentKeyId(): string {
		return this.currentId;
	}

	wrap(dataKey: Buffer, context: EncryptionContext): WrappedDataKey {
		const key = this.key(this.currentId);
		const nonce = randomBytes(ENCRYPTION_NONCE_BYTES);
		const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, nonce);
		const authenticatedContext = wrappedKeyContextBytes(context);
		try {
			cipher.setAAD(authenticatedContext);
			return {
				keyId: this.currentId,
				ciphertext: Buffer.concat([
					cipher.update(dataKey),
					cipher.final(),
				]).toString(ENCRYPTION_ENCODING),
				nonce: nonce.toString(ENCRYPTION_ENCODING),
				authTag: cipher.getAuthTag().toString(ENCRYPTION_ENCODING),
			};
		} finally {
			authenticatedContext.fill(0);
		}
	}

	unwrap(wrappedKey: WrappedDataKey, context: EncryptionContext): Buffer {
		const key = this.key(wrappedKey.keyId);
		const nonce = Buffer.from(wrappedKey.nonce, ENCRYPTION_ENCODING);
		const authTag = Buffer.from(wrappedKey.authTag, ENCRYPTION_ENCODING);
		const ciphertext = Buffer.from(wrappedKey.ciphertext, ENCRYPTION_ENCODING);
		const authenticatedContext = wrappedKeyContextBytes(context);
		try {
			const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, nonce);
			decipher.setAAD(authenticatedContext);
			decipher.setAuthTag(authTag);
			return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
		} finally {
			nonce.fill(0);
			authTag.fill(0);
			ciphertext.fill(0);
			authenticatedContext.fill(0);
		}
	}

	onModuleDestroy(): void {
		for (const key of this.keys.values()) key.fill(0);
		this.keys.clear();
	}

	private key(keyId: string): Buffer {
		for (const [candidateId, key] of this.keys) {
			const requested = Buffer.from(keyId, 'utf8');
			const candidate = Buffer.from(candidateId, 'utf8');
			const matches =
				requested.byteLength === candidate.byteLength &&
				timingSafeEqual(requested, candidate);
			requested.fill(0);
			candidate.fill(0);
			if (matches) return key;
		}
		throw new Error(`Encryption key ${keyId} is not available`);
	}
}
