/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';
import {
	ENCRYPTION_AUTH_TAG_BYTES,
	ENCRYPTION_CONTEXT_SCHEMA_VERSION,
	ENCRYPTION_ENCODING,
	ENCRYPTION_ENVELOPE_VERSION,
	ENCRYPTION_KEY_BYTES,
	ENCRYPTION_KEY_ID_PATTERN,
	ENCRYPTION_KEYRING_SCHEMA,
	ENCRYPTION_NONCE_BYTES,
	ENCRYPTION_RECORD_KIND_PATTERN,
} from '../constants/encryption.constants';

function encodedBytes(bytes: number) {
	return z.string().refine(
		(value) => {
			try {
				const decoded = Buffer.from(value, ENCRYPTION_ENCODING);
				return (
					decoded.byteLength === bytes &&
					decoded.toString(ENCRYPTION_ENCODING) === value
				);
			} catch {
				return false;
			}
		},
		{ message: `must encode exactly ${bytes} bytes` }
	);
}

export const encryptionContextSchema = z
	.object({
		recordKind: z.string().regex(ENCRYPTION_RECORD_KIND_PATTERN),
		organizationId: z.string().uuid(),
		recordId: z.string().uuid(),
		recordVersion: z.number().int().positive(),
		schemaVersion: z.literal(ENCRYPTION_CONTEXT_SCHEMA_VERSION),
	})
	.strict();
export type EncryptionContext = z.infer<typeof encryptionContextSchema>;

const wrappedDataKeySchema = z
	.object({
		keyId: z.string().regex(ENCRYPTION_KEY_ID_PATTERN),
		ciphertext: encodedBytes(ENCRYPTION_KEY_BYTES),
		nonce: encodedBytes(ENCRYPTION_NONCE_BYTES),
		authTag: encodedBytes(ENCRYPTION_AUTH_TAG_BYTES),
	})
	.strict();
export type WrappedDataKey = z.infer<typeof wrappedDataKeySchema>;

export const encryptedEnvelopeSchema = z
	.object({
		version: z.literal(ENCRYPTION_ENVELOPE_VERSION),
		keyId: z.string().regex(ENCRYPTION_KEY_ID_PATTERN),
		wrappedDataKey: z.string(),
		wrappedDataKeyNonce: encodedBytes(ENCRYPTION_NONCE_BYTES),
		wrappedDataKeyAuthTag: encodedBytes(ENCRYPTION_AUTH_TAG_BYTES),
		ciphertext: z.string(),
		nonce: encodedBytes(ENCRYPTION_NONCE_BYTES),
		authTag: encodedBytes(ENCRYPTION_AUTH_TAG_BYTES),
	})
	.strict();
export type EncryptedEnvelope = z.infer<typeof encryptedEnvelopeSchema>;

export const keyringSchema = z
	.object({
		schema: z.literal(ENCRYPTION_KEYRING_SCHEMA),
		currentKeyId: z.string().regex(ENCRYPTION_KEY_ID_PATTERN),
		keys: z.record(
			z.string().regex(ENCRYPTION_KEY_ID_PATTERN),
			encodedBytes(ENCRYPTION_KEY_BYTES)
		),
	})
	.strict()
	.superRefine((value, context) => {
		if (!(value.currentKeyId in value.keys)) {
			context.addIssue({
				code: 'custom',
				message: 'currentKeyId must identify a configured key',
				path: ['currentKeyId'],
			});
		}
	});
export type Keyring = z.infer<typeof keyringSchema>;
