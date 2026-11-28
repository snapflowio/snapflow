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
	encodeAbiParameters,
	type Hex,
	hashTypedData,
	keccak256,
	recoverTypedDataAddress,
} from 'viem';
import type { EscrowDomain } from './domain.js';
import { assertEscrowSignature } from './signature.js';

const channelFields = [
	{ name: 'customer', type: 'address' },
	{ name: 'host', type: 'address' },
	{ name: 'feeReceiver', type: 'address' },
	{ name: 'feeBps', type: 'uint16' },
	{ name: 'salt', type: 'bytes32' },
] as const;

const channelIdParameters = [
	{ name: 'chainId', type: 'uint256' },
	{ name: 'escrow', type: 'address' },
	...channelFields,
] as const;

export const voucherTypes = {
	Voucher: [
		...channelFields,
		{ name: 'cumulativeAmount', type: 'uint128' },
		{ name: 'timestamp', type: 'uint64' },
		{ name: 'metadata', type: 'bytes32' },
	],
} as const;

export type Voucher = TypedDataToPrimitiveTypes<typeof voucherTypes>['Voucher'];

export type ChannelTerms = TypedDataToPrimitiveTypes<{
	ChannelTerms: typeof channelFields;
}>['ChannelTerms'];

export function channelIdOf(domain: EscrowDomain, terms: ChannelTerms): Hex {
	return keccak256(
		encodeAbiParameters(channelIdParameters, [
			BigInt(domain.chainId),
			domain.verifyingContract,
			terms.customer,
			terms.host,
			terms.feeReceiver,
			terms.feeBps,
			terms.salt,
		])
	);
}

export function voucherTypedData(domain: EscrowDomain, message: Voucher) {
	return {
		domain,
		types: voucherTypes,
		primaryType: 'Voucher',
		message,
	} as const;
}

export function hashVoucher(domain: EscrowDomain, voucher: Voucher): Hex {
	return hashTypedData(voucherTypedData(domain, voucher));
}

export async function recoverVoucherSigner(
	domain: EscrowDomain,
	voucher: Voucher,
	signature: Hex
): Promise<Address> {
	assertEscrowSignature(signature);
	return recoverTypedDataAddress({
		...voucherTypedData(domain, voucher),
		signature,
	});
}
