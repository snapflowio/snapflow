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

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Address, getAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import {
	channelIdFor,
	escrowDomain,
	hashVoucher,
	recoverVoucherSigner,
	type Voucher,
	voucherTypedData,
} from './voucher.js';

const VECTORS_PATH = '../../../apps/contracts/test/vectors/vouchers.json';

/** The vectors JSON writes every integer as a decimal string. */
type VectorEntry = {
	[Field in keyof Voucher]: Voucher[Field] extends bigint
		? string
		: Voucher[Field];
} & {
	digest: Hex;
	signature: Hex;
};

interface ChannelVector {
	customer: Address;
	host: Address;
	leaseId: string;
	channelId: Hex;
}

interface VoucherVectors {
	chainId: number;
	verifyingContract: Address;
	signer: Address;
	signerKey: Hex;
	vouchers: VectorEntry[];
	channels: ChannelVector[];
}

const vectors: VoucherVectors = JSON.parse(
	readFileSync(fileURLToPath(new URL(VECTORS_PATH, import.meta.url)), 'utf8')
);

const domain = escrowDomain(vectors.chainId, vectors.verifyingContract);

function toVoucher(entry: VectorEntry): Voucher {
	return {
		channelId: entry.channelId,
		customer: getAddress(entry.customer),
		host: getAddress(entry.host),
		hostAmount: BigInt(entry.hostAmount),
		feeAmount: BigInt(entry.feeAmount),
		serviceAmount: BigInt(entry.serviceAmount),
		sequence: BigInt(entry.sequence),
		expiry: BigInt(entry.expiry),
	};
}

describe('voucher hashing', () => {
	it.each(vectors.vouchers)(
		'matches the contract digest at sequence $sequence',
		(entry) => {
			expect(hashVoucher(domain, toVoucher(entry))).toBe(entry.digest);
		}
	);

	it.each(vectors.vouchers)(
		'recovers the signer at sequence $sequence',
		async (entry) => {
			await expect(
				recoverVoucherSigner(domain, toVoucher(entry), entry.signature)
			).resolves.toBe(getAddress(vectors.signer));
		}
	);

	it.each(vectors.vouchers)(
		'signs exactly like the contract test signer at sequence $sequence',
		async (entry) => {
			const account = privateKeyToAccount(vectors.signerKey);
			await expect(
				account.signTypedData(voucherTypedData(domain, toVoucher(entry)))
			).resolves.toBe(entry.signature);
		}
	);
});

describe('channel ids', () => {
	it.each(vectors.channels)(
		'derives the contract channel for lease "$leaseId"',
		(channel) => {
			expect(
				channelIdFor(
					getAddress(channel.customer),
					getAddress(channel.host),
					channel.leaseId
				)
			).toBe(channel.channelId);
		}
	);
});
