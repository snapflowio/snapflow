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

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { type Hex, hexToBigInt, hexToNumber, size, slice } from 'viem';

const SIGNATURE_BYTES = 65;
const SCALAR_BYTES = 32;
const LEGACY_RECOVERY_OFFSET = 27;
const HALF_CURVE_ORDER = secp256k1.Point.CURVE().n / 2n;

export class InvalidEscrowSignatureError extends Error {
	override readonly name = 'InvalidEscrowSignatureError';
}

export function assertEscrowSignature(signature: Hex): void {
	const length = size(signature);
	if (length !== SIGNATURE_BYTES) {
		throw new InvalidEscrowSignatureError(
			`signature is ${length} bytes, not ${SIGNATURE_BYTES}`
		);
	}
	const recoveryId = hexToNumber(slice(signature, 2 * SCALAR_BYTES));
	const yParity = recoveryId - LEGACY_RECOVERY_OFFSET;
	if (yParity !== 0 && yParity !== 1) {
		throw new InvalidEscrowSignatureError(
			`recovery id ${recoveryId} is not ${LEGACY_RECOVERY_OFFSET} or ${LEGACY_RECOVERY_OFFSET + 1}`
		);
	}
	const s = hexToBigInt(slice(signature, SCALAR_BYTES, 2 * SCALAR_BYTES));
	if (s > HALF_CURVE_ORDER) {
		throw new InvalidEscrowSignatureError(
			's is in the upper half of the curve order'
		);
	}
}
