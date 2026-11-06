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

export const ESCROW_DOMAIN_NAME = 'SnapflowEscrow';
export const ESCROW_DOMAIN_VERSION = '1';

/** Mirrors `VoucherHashing.VOUCHER_TYPEHASH` in apps/contracts; the shared vectors keep the two in step. */
export const voucherTypes = {
	Voucher: [
		{ name: 'channelId', type: 'bytes32' },
		{ name: 'customer', type: 'address' },
		{ name: 'host', type: 'address' },
		{ name: 'hostAmount', type: 'uint256' },
		{ name: 'feeAmount', type: 'uint256' },
		{ name: 'serviceAmount', type: 'uint256' },
		{ name: 'sequence', type: 'uint64' },
		{ name: 'expiry', type: 'uint64' },
	],
} as const;

export type Voucher = TypedDataToPrimitiveTypes<typeof voucherTypes>['Voucher'];

const channelIdParameters = [
	{ name: 'customer', type: 'address' },
	{ name: 'host', type: 'address' },
	{ name: 'leaseId', type: 'string' },
] as const;

export function escrowDomain(chainId: number, verifyingContract: Address) {
	return {
		name: ESCROW_DOMAIN_NAME,
		version: ESCROW_DOMAIN_VERSION,
		chainId,
		verifyingContract,
	} as const;
}

export type EscrowDomain = ReturnType<typeof escrowDomain>;

/** The EIP-712 payload for signing a voucher with a viem account or wallet client. */
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

export function recoverVoucherSigner(
	domain: EscrowDomain,
	voucher: Voucher,
	signature: Hex
): Promise<Address> {
	return recoverTypedDataAddress({
		...voucherTypedData(domain, voucher),
		signature,
	});
}

/** One channel per sandbox lease; the host daemon derives the same id to match vouchers to sandboxes. */
export function channelIdFor(
	customer: Address,
	host: Address,
	leaseId: string
): Hex {
	return keccak256(
		encodeAbiParameters(channelIdParameters, [customer, host, leaseId])
	);
}
