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

import type { TypedDataToPrimitiveTypes } from 'abitype';
import {
	type Address,
	type Hex,
	hashTypedData,
	recoverTypedDataAddress,
} from 'viem';
import type { EscrowDomain } from './domain.js';
import { assertEscrowSignature } from './signature.js';

export const payoutAddressTypes = {
	PayoutAddress: [
		{ name: 'host', type: 'address' },
		{ name: 'payout', type: 'address' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'deadline', type: 'uint256' },
	],
} as const;

export type PayoutAddress = TypedDataToPrimitiveTypes<
	typeof payoutAddressTypes
>['PayoutAddress'];

export function payoutAddressTypedData(
	domain: EscrowDomain,
	message: PayoutAddress
) {
	return {
		domain,
		types: payoutAddressTypes,
		primaryType: 'PayoutAddress',
		message,
	} as const;
}

export function hashPayoutAddress(
	domain: EscrowDomain,
	change: PayoutAddress
): Hex {
	return hashTypedData(payoutAddressTypedData(domain, change));
}

export async function recoverPayoutAddressSigner(
	domain: EscrowDomain,
	change: PayoutAddress,
	signature: Hex
): Promise<Address> {
	assertEscrowSignature(signature);
	return recoverTypedDataAddress({
		...payoutAddressTypedData(domain, change),
		signature,
	});
}
