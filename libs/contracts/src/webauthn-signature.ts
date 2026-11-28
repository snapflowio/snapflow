/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { p256 } from '@noble/curves/nist.js';
import {
	type Address,
	concat,
	decodeAbiParameters,
	encodeAbiParameters,
	type Hex,
	hexToBytes,
	numberToHex,
	pad,
	parseAbiParameters,
	size,
	stringToHex,
} from 'viem';

const webAuthnSignatureParameters = parseAbiParameters(
	'bytes authenticatorData, bytes clientDataFields, uint256[2] signature'
);

export interface WebAuthnAssertion {
	authenticatorData: Hex;
	clientDataJSON: string;
	signature: Hex;
}

const HASH_CHALLENGE_LENGTH = 43;

const P256_ORDER = p256.Point.CURVE().n;

const CLIENT_DATA_PATTERN = new RegExp(
	`^\\{"type":"webauthn\\.get","challenge":"[A-Za-z0-9\\-_]{${HASH_CHALLENGE_LENGTH}}",(.*)\\}$`
);

function webAuthnClientDataFields(clientDataJSON: string): Hex {
	const fields = CLIENT_DATA_PATTERN.exec(clientDataJSON)?.[1];
	if (fields === undefined) {
		throw new Error('The client data is not a WebAuthn assertion of a hash');
	}
	return stringToHex(fields);
}

function decodeDerSignature(signature: Hex): readonly [bigint, bigint] {
	const decoded = p256.Signature.fromBytes(hexToBytes(signature), 'der');
	return [decoded.r, decoded.hasHighS() ? P256_ORDER - decoded.s : decoded.s];
}

export function encodeWebAuthnSignature(assertion: WebAuthnAssertion): Hex {
	return encodeAbiParameters(webAuthnSignatureParameters, [
		assertion.authenticatorData,
		webAuthnClientDataFields(assertion.clientDataJSON),
		decodeDerSignature(assertion.signature),
	]);
}

export function decodeWebAuthnSignature(signature: Hex) {
	const decoded = decodeAbiParameters(webAuthnSignatureParameters, signature);
	const canonical = encodeAbiParameters(webAuthnSignatureParameters, decoded);
	if (canonical.toLowerCase() !== signature.toLowerCase()) {
		throw new Error('The WebAuthn signature is not canonically encoded');
	}
	return decoded;
}

const SAFE_SIGNATURE_BYTES = 65;
const CONTRACT_SIGNATURE_TYPE = 0;
const WORD_BYTES = 32;

export function safeContractSignature(owner: Address, data: Hex): Hex {
	return concat([
		pad(owner, { size: WORD_BYTES }),
		numberToHex(SAFE_SIGNATURE_BYTES, { size: WORD_BYTES }),
		numberToHex(CONTRACT_SIGNATURE_TYPE, { size: 1 }),
		numberToHex(size(data), { size: WORD_BYTES }),
		data,
	]);
}
