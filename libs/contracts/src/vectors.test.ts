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
import { type DepositAuthorization, depositNonceOf } from './deposit.js';
import {
	ESCROW_DOMAIN_NAME,
	ESCROW_DOMAIN_VERSION,
	escrowDomain,
} from './domain.js';
import {
	type HostWithdrawal,
	hashHostWithdrawal,
	hostWithdrawalTypedData,
	recoverHostWithdrawalSigner,
} from './host-withdrawal.js';
import {
	hashPayoutAddress,
	type PayoutAddress,
	payoutAddressTypedData,
	recoverPayoutAddressSigner,
} from './payout-address.js';
import { InvalidEscrowSignatureError } from './signature.js';
import {
	hashSignerProof,
	recoverSignerProofSigner,
	signerProofMessage,
} from './signer-proof.js';
import {
	channelIdOf,
	hashVoucher,
	recoverVoucherSigner,
	type Voucher,
	voucherTypedData,
} from './voucher.js';

const VECTORS_PATH = '../../../apps/contracts/test/vectors/vouchers.json';
const SUPPORTED_VERSION = '2';

type Decimal<Value> = {
	[Field in keyof Value]: Value[Field] extends bigint | number
		? string
		: Value[Field];
};
type Named = { name: string };
type Signed = { digest: Hex; signature: Hex };

type VectorFile = {
	version: string;
	chainId: number;
	verifyingContract: Address;
	domainName: string;
	domainVersion: string;
	signer: Address;
	signerKey: Hex;
	host: Address;
	hostKey: Hex;
	vouchers: (Named & Decimal<Voucher> & Signed & { channelId: Hex })[];
	signerProofs: (Named & { customer: Address; deadline: string } & Signed)[];
	hostWithdrawals: (Named & Decimal<HostWithdrawal> & Signed)[];
	payoutAddresses: (Named & Decimal<PayoutAddress> & Signed)[];
	depositNonces: (Named & Decimal<DepositAuthorization> & { nonce: Hex })[];
	invalidVoucherSignatures: (Named & { voucher: string; signature: Hex })[];
};

const vectors: VectorFile = JSON.parse(
	readFileSync(fileURLToPath(new URL(VECTORS_PATH, import.meta.url)), 'utf8')
);

const domain = escrowDomain(vectors.chainId, vectors.verifyingContract);
const signerAccount = privateKeyToAccount(vectors.signerKey);
const hostAccount = privateKeyToAccount(vectors.hostKey);

function toVoucher(entry: Decimal<Voucher>): Voucher {
	return {
		customer: getAddress(entry.customer),
		host: getAddress(entry.host),
		feeReceiver: getAddress(entry.feeReceiver),
		feeBps: Number(entry.feeBps),
		salt: entry.salt,
		cumulativeAmount: BigInt(entry.cumulativeAmount),
		timestamp: BigInt(entry.timestamp),
		metadata: entry.metadata,
	};
}

function toHostWithdrawal(entry: Decimal<HostWithdrawal>): HostWithdrawal {
	return {
		host: getAddress(entry.host),
		payout: getAddress(entry.payout),
		relayer: getAddress(entry.relayer),
		relayFee: BigInt(entry.relayFee),
		nonce: BigInt(entry.nonce),
		deadline: BigInt(entry.deadline),
	};
}

function toPayoutAddress(entry: Decimal<PayoutAddress>): PayoutAddress {
	return {
		host: getAddress(entry.host),
		payout: getAddress(entry.payout),
		nonce: BigInt(entry.nonce),
		deadline: BigInt(entry.deadline),
	};
}

function toDepositAuthorization(
	entry: Decimal<DepositAuthorization>
): DepositAuthorization {
	return {
		payer: getAddress(entry.payer),
		customer: getAddress(entry.customer),
		relayer: getAddress(entry.relayer),
		amount: BigInt(entry.amount),
		relayFee: BigInt(entry.relayFee),
		validAfter: BigInt(entry.validAfter),
		validBefore: BigInt(entry.validBefore),
		salt: entry.salt,
	};
}

async function recoversVoucherSigner(
	voucher: Voucher,
	signature: Hex
): Promise<boolean> {
	try {
		const recovered = await recoverVoucherSigner(domain, voucher, signature);
		return recovered === getAddress(vectors.signer);
	} catch (error) {
		if (error instanceof InvalidEscrowSignatureError) {
			return false;
		}
		throw error;
	}
}

describe('header', () => {
	it('uses the supported format version', () => {
		expect(vectors.version).toBe(SUPPORTED_VERSION);
	});

	it('matches the contract domain', () => {
		expect(ESCROW_DOMAIN_NAME).toBe(vectors.domainName);
		expect(ESCROW_DOMAIN_VERSION).toBe(vectors.domainVersion);
	});
});

describe('vouchers', () => {
	it.each(vectors.vouchers)('$name', async (entry) => {
		const voucher = toVoucher(entry);
		expect(hashVoucher(domain, voucher)).toBe(entry.digest);
		expect(channelIdOf(domain, voucher)).toBe(entry.channelId);
		await expect(
			recoverVoucherSigner(domain, voucher, entry.signature)
		).resolves.toBe(getAddress(vectors.signer));
		await expect(
			signerAccount.signTypedData(voucherTypedData(domain, voucher))
		).resolves.toBe(entry.signature);
	});
});

describe('signer proofs', () => {
	it.each(vectors.signerProofs)('$name', async (entry) => {
		const deadline = BigInt(entry.deadline);
		const customer = getAddress(entry.customer);
		expect(hashSignerProof(domain, deadline, customer)).toBe(entry.digest);
		await expect(
			recoverSignerProofSigner(domain, deadline, customer, entry.signature)
		).resolves.toBe(getAddress(vectors.signer));
		await expect(
			signerAccount.signMessage({
				message: signerProofMessage(domain, deadline, customer),
			})
		).resolves.toBe(entry.signature);
	});
});

describe('host withdrawals', () => {
	it.each(vectors.hostWithdrawals)('$name', async (entry) => {
		const withdrawal = toHostWithdrawal(entry);
		expect(hashHostWithdrawal(domain, withdrawal)).toBe(entry.digest);
		await expect(
			recoverHostWithdrawalSigner(domain, withdrawal, entry.signature)
		).resolves.toBe(getAddress(vectors.host));
		await expect(
			hostAccount.signTypedData(hostWithdrawalTypedData(domain, withdrawal))
		).resolves.toBe(entry.signature);
	});
});

describe('payout addresses', () => {
	it.each(vectors.payoutAddresses)('$name', async (entry) => {
		const change = toPayoutAddress(entry);
		expect(hashPayoutAddress(domain, change)).toBe(entry.digest);
		await expect(
			recoverPayoutAddressSigner(domain, change, entry.signature)
		).resolves.toBe(getAddress(vectors.host));
		await expect(
			hostAccount.signTypedData(payoutAddressTypedData(domain, change))
		).resolves.toBe(entry.signature);
	});
});

describe('deposit nonces', () => {
	it.each(vectors.depositNonces)('$name', (entry) => {
		expect(depositNonceOf(domain, toDepositAuthorization(entry))).toBe(
			entry.nonce
		);
	});
});

describe('invalid voucher signatures', () => {
	it.each(vectors.invalidVoucherSignatures)('rejects $name', async (entry) => {
		const signed = vectors.vouchers[Number(entry.voucher)];
		expect(signed).toBeDefined();
		if (signed === undefined) {
			return;
		}
		await expect(
			recoversVoucherSigner(toVoucher(signed), entry.signature)
		).resolves.toBe(false);
	});
});
