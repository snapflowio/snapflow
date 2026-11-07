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

import {
	type PaymentChannel,
	PaymentChannelKind,
	PaymentChannelState,
	type PendingVoucher,
	VoucherSigningMode,
} from '@snapflow/api-client';
import {
	channelIdFor,
	ESCROW_DOMAIN_NAME,
	ESCROW_DOMAIN_VERSION,
} from '@snapflow/contracts';
import { getAddress } from 'viem';
import {
	SnapflowVoucherRejectedError,
	VoucherRejectionReason,
} from '../errors/settlement-error.js';
import {
	type SignedVoucherRecord,
	type VoucherVerification,
	verifyChannel,
	verifyPendingVoucher,
} from './voucher-verification.js';

const NOW = Date.UTC(2026, 10, 5, 12);
const HOUR_MILLISECONDS = 3_600_000;
const DAY_SECONDS = 86_400;
const CHAIN_ID = 31_337;
const OTHER_CHAIN_ID = 8453;
const CUSTOMER = getAddress('0x1111111111111111111111111111111111111111');
const HOST = getAddress('0x2222222222222222222222222222222222222222');
const OTHER = getAddress('0x3333333333333333333333333333333333333333');
const ESCROW = getAddress('0x4444444444444444444444444444444444444444');
const LEASE_ID = 'lease-1';
const SANDBOX_ID = 'sandbox-1';
const CHANNEL_ID = channelIdFor(CUSTOMER, HOST, LEASE_ID);
const DOMAIN = {
	name: ESCROW_DOMAIN_NAME,
	version: ESCROW_DOMAIN_VERSION,
	chainId: CHAIN_ID,
	verifyingContract: ESCROW,
};

function pendingVoucher(
	overrides: Partial<PendingVoucher['voucher']['message']> = {},
	sequence = 1
): PendingVoucher {
	return {
		channelId: CHANNEL_ID,
		kind: PaymentChannelKind.Lease,
		sandboxId: SANDBOX_ID,
		leaseId: LEASE_ID,
		servicePeriodStart: null,
		voucher: {
			sequence,
			message: {
				channelId: CHANNEL_ID,
				customer: CUSTOMER,
				host: HOST,
				hostAmount: '800000',
				feeAmount: '200000',
				serviceAmount: '0',
				sequence: String(sequence),
				expiry: String(NOW / 1000 + DAY_SECONDS),
				...overrides,
			},
			issuedAt: new Date(NOW).toISOString(),
			expiresAt: new Date(NOW + DAY_SECONDS * 1000).toISOString(),
			signerAddress: null,
			signature: null,
			signedAt: null,
		},
	};
}

function paymentChannel(
	overrides: Partial<PaymentChannel> = {}
): PaymentChannel {
	return {
		channelId: CHANNEL_ID,
		kind: PaymentChannelKind.Lease,
		leaseId: LEASE_ID,
		sandboxId: SANDBOX_ID,
		servicePeriodStart: null,
		signingMode: VoucherSigningMode.Client,
		state: PaymentChannelState.Open,
		customerAddress: CUSTOMER,
		hostAddress: HOST,
		openedAt: new Date(NOW - HOUR_MILLISECONDS).toISOString(),
		closedAt: null,
		coveredAt: new Date(NOW).toISOString(),
		voucherError: null,
		claimedSequence: 0,
		claimError: null,
		latestVoucher: null,
		...overrides,
	};
}

function verification(
	entry: PendingVoucher,
	lastSigned?: SignedVoucherRecord
): VoucherVerification {
	return {
		domain: DOMAIN,
		escrow: { chainId: CHAIN_ID, verifyingContract: ESCROW },
		entry,
		channel: verifyChannel(entry, paymentChannel(), CUSTOMER),
		lastSigned,
		policy: { maxHourlySpend: 1_000_000n },
		now: NOW,
	};
}

function rejectionReason(run: () => unknown): VoucherRejectionReason {
	try {
		run();
	} catch (error) {
		if (error instanceof SnapflowVoucherRejectedError) return error.reason;
		throw error;
	}
	throw new Error('The voucher was accepted');
}

describe('verifyChannel', () => {
	it('accepts a client lease channel of the funding wallet derived from its lease', () => {
		expect(verifyChannel(pendingVoucher(), paymentChannel(), CUSTOMER)).toEqual(
			{
				channelId: CHANNEL_ID,
				customer: CUSTOMER,
				host: HOST,
				leaseId: LEASE_ID,
				sandboxId: SANDBOX_ID,
				openedAt: NOW - HOUR_MILLISECONDS,
			}
		);
	});

	it('refuses a channel whose id does not derive from its parties and lease', () => {
		expect(
			rejectionReason(() =>
				verifyChannel(
					pendingVoucher(),
					paymentChannel({ hostAddress: OTHER }),
					CUSTOMER
				)
			)
		).toBe(VoucherRejectionReason.ChannelMismatch);
	});

	it('refuses a channel paid by another wallet', () => {
		expect(
			rejectionReason(() =>
				verifyChannel(pendingVoucher(), paymentChannel(), OTHER)
			)
		).toBe(VoucherRejectionReason.CustomerMismatch);
	});

	it('refuses a channel of another sandbox or a platform service channel', () => {
		expect(
			rejectionReason(() =>
				verifyChannel(
					pendingVoucher(),
					paymentChannel({ sandboxId: 'sandbox-2' }),
					CUSTOMER
				)
			)
		).toBe(VoucherRejectionReason.ChannelMismatch);
		expect(
			rejectionReason(() =>
				verifyChannel(
					pendingVoucher(),
					paymentChannel({ kind: PaymentChannelKind.PlatformService }),
					CUSTOMER
				)
			)
		).toBe(VoucherRejectionReason.ChannelMismatch);
	});
});

describe('verifyPendingVoucher', () => {
	it('returns the typed voucher and domain to sign', () => {
		const { domain, voucher } = verifyPendingVoucher(
			verification(pendingVoucher())
		);

		expect(domain).toEqual(DOMAIN);
		expect(voucher).toEqual({
			channelId: CHANNEL_ID,
			customer: CUSTOMER,
			host: HOST,
			hostAmount: 800_000n,
			feeAmount: 200_000n,
			serviceAmount: 0n,
			sequence: 1n,
			expiry: BigInt(NOW / 1000 + DAY_SECONDS),
		});
	});

	it('refuses a domain other than the trusted escrow', () => {
		const refused = (domain: Partial<typeof DOMAIN>) =>
			rejectionReason(() =>
				verifyPendingVoucher({
					...verification(pendingVoucher()),
					domain: { ...DOMAIN, ...domain },
				})
			);

		expect(refused({ name: 'Other' })).toBe(
			VoucherRejectionReason.DomainMismatch
		);
		expect(refused({ chainId: OTHER_CHAIN_ID })).toBe(
			VoucherRejectionReason.DomainMismatch
		);
		expect(refused({ verifyingContract: OTHER })).toBe(
			VoucherRejectionReason.DomainMismatch
		);
	});

	it('refuses a voucher paying another host or customer', () => {
		expect(
			rejectionReason(() =>
				verifyPendingVoucher(verification(pendingVoucher({ host: OTHER })))
			)
		).toBe(VoucherRejectionReason.ChannelMismatch);
		expect(
			rejectionReason(() =>
				verifyPendingVoucher(verification(pendingVoucher({ customer: OTHER })))
			)
		).toBe(VoucherRejectionReason.CustomerMismatch);
	});

	it('refuses malformed and expired vouchers', () => {
		expect(
			rejectionReason(() =>
				verifyPendingVoucher(verification(pendingVoucher({ hostAmount: '-1' })))
			)
		).toBe(VoucherRejectionReason.Malformed);
		expect(
			rejectionReason(() =>
				verifyPendingVoucher(
					verification(pendingVoucher({ expiry: String(NOW / 1000) }))
				)
			)
		).toBe(VoucherRejectionReason.Expired);
	});

	it('refuses a voucher that does not advance the last signed one', () => {
		const last = verifyPendingVoucher(
			verification(pendingVoucher({}, 2))
		).voucher;
		const signed = { voucher: last, signedAt: NOW - HOUR_MILLISECONDS };

		expect(
			rejectionReason(() =>
				verifyPendingVoucher(verification(pendingVoucher({}, 2), signed))
			)
		).toBe(VoucherRejectionReason.StaleSequence);
		expect(
			rejectionReason(() =>
				verifyPendingVoucher(
					verification(pendingVoucher({ feeAmount: '199999' }, 3), signed)
				)
			)
		).toBe(VoucherRejectionReason.AmountDecreased);
	});

	it('refuses growth beyond the spend policy', () => {
		expect(
			rejectionReason(() =>
				verifyPendingVoucher(
					verification(pendingVoucher({ hostAmount: '2000000' }))
				)
			)
		).toBe(VoucherRejectionReason.HourlyRateExceeded);
		expect(
			rejectionReason(() =>
				verifyPendingVoucher({
					...verification(pendingVoucher()),
					policy: { maxHourlySpend: 1_000_000n, maxChannelSpend: 999_999n },
				})
			)
		).toBe(VoucherRejectionReason.ChannelCapExceeded);
	});
});
