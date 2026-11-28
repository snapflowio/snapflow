/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	cose,
	decodeCredentialPublicKey,
} from '@simplewebauthn/server/helpers';
import type { P256PublicKey } from '@snapflow/contracts';
import { bytesToBigInt } from 'viem';

export const WALLET_PASSKEY_ALGORITHM = cose.COSEALG.ES256;

const P256_COORDINATE_BYTES = 32;
const STORED_PUBLIC_KEY_ENCODING = 'base64';

export function p256PublicKey(cosePublicKey: Uint8Array): P256PublicKey | null {
	let decoded: cose.COSEPublicKey;
	try {
		decoded = decodeCredentialPublicKey(new Uint8Array(cosePublicKey));
	} catch {
		return null;
	}
	if (
		!(decoded instanceof Map) ||
		!cose.isCOSEPublicKeyEC2(decoded) ||
		decoded.get(cose.COSEKEYS.alg) !== WALLET_PASSKEY_ALGORITHM ||
		decoded.get(cose.COSEKEYS.crv) !== cose.COSECRV.P256
	) {
		return null;
	}
	const x = decoded.get(cose.COSEKEYS.x);
	const y = decoded.get(cose.COSEKEYS.y);
	if (
		x?.length !== P256_COORDINATE_BYTES ||
		y?.length !== P256_COORDINATE_BYTES
	) {
		return null;
	}
	return { x: bytesToBigInt(x), y: bytesToBigInt(y) };
}

export function storedPasskeyPublicKey(
	publicKey: string
): P256PublicKey | null {
	return p256PublicKey(
		new Uint8Array(Buffer.from(publicKey, STORED_PUBLIC_KEY_ENCODING))
	);
}
