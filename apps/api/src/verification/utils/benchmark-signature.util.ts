/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createPublicKey, type KeyObject, verify } from 'node:crypto';
import type { JsonObject } from '@bufbuild/protobuf';
import { canonicalJson } from '../../common/utils/canonical-json.util';

const SIGNATURE_FIELD = 'signature';

export function signedResultPayload(resultJson: JsonObject): Buffer {
	return Buffer.from(
		canonicalJson(
			Object.fromEntries(
				Object.entries(resultJson).filter(
					([field]) => field !== SIGNATURE_FIELD
				)
			)
		),
		'utf8'
	);
}

export function ed25519PublicKey(publicKeyPem: string): KeyObject | null {
	try {
		return createPublicKey(publicKeyPem);
	} catch {
		return null;
	}
}

export function verifyEd25519(
	publicKeyPem: string,
	message: Uint8Array,
	signature: Uint8Array
): boolean {
	const key = ed25519PublicKey(publicKeyPem);
	return key !== null && verify(null, message, key, signature);
}

export function verifySignedResult(
	resultJson: JsonObject,
	publicKeyPem: string,
	signature: Uint8Array
): boolean {
	return verifyEd25519(
		publicKeyPem,
		signedResultPayload(resultJson),
		signature
	);
}
