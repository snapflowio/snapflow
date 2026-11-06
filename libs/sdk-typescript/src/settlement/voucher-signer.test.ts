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
	type EscrowAccount,
	type PaymentChannel,
	PaymentChannelKind,
	PaymentChannelState,
	type PendingVouchers,
	type SubmitVoucherSignature,
	VoucherSigningMode,
} from '@snapflow/api-client';
import {
	channelIdFor,
	ESCROW_DOMAIN_NAME,
	ESCROW_DOMAIN_VERSION,
	escrowDomain,
	recoverVoucherSigner,
} from '@snapflow/contracts';
import { getAddress, type Hex } from 'viem';
import {
	SnapflowVoucherRejectedError,
	VoucherRejectionReason,
} from '../errors/settlement-error.js';
import { createApiClient } from '../snapflow/client-config.js';
import { generateSessionKey } from './session-key.js';
import {
	CHANNEL_RETENTION_MILLISECONDS,
	VoucherSigner,
	type VoucherSignerOptions,
} from './voucher-signer.js';
import { parseVoucher } from './voucher-verification.js';

const API_URL = 'https://api.snapflow.test';
const NOW = Date.UTC(2026, 10, 5, 12);
const HOUR_MILLISECONDS = 3_600_000;
const DAY_SECONDS = 86_400;
const POLL_INTERVAL_MILLISECONDS = 10_000;
const FIRST_BACKOFF_MILLISECONDS = 1_000;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;
const CHAIN_ID = 31_337;
const CUSTOMER = getAddress('0x1111111111111111111111111111111111111111');
const HOST = getAddress('0x2222222222222222222222222222222222222222');
const ESCROW = getAddress('0x4444444444444444444444444444444444444444');
const OTHER_ESCROW = getAddress('0x7777777777777777777777777777777777777777');
const USDC = getAddress('0x5555555555555555555555555555555555555555');
const LEASE_ID = 'lease-1';
const SANDBOX_ID = 'sandbox-1';
const CHANNEL_ID = channelIdFor(CUSTOMER, HOST, LEASE_ID);
const DOMAIN = {
	name: ESCROW_DOMAIN_NAME,
	version: ESCROW_DOMAIN_VERSION,
	chainId: CHAIN_ID,
	verifyingContract: ESCROW,
};

function pending(
	hostAmount = '800000',
	sequence = 1,
	verifyingContract: string = ESCROW
): PendingVouchers {
	return {
		domain: { ...DOMAIN, verifyingContract },
		vouchers: [
			{
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
						hostAmount,
						feeAmount: '200000',
						serviceAmount: '0',
						sequence: String(sequence),
						expiry: String(NOW / 1000 + DAY_SECONDS),
					},
					issuedAt: new Date(NOW).toISOString(),
					expiresAt: new Date(NOW + DAY_SECONDS * 1000).toISOString(),
					signerAddress: null,
					signature: null,
					signedAt: null,
				},
			},
		],
	};
}

function channel(
	signingMode: VoucherSigningMode = VoucherSigningMode.Client
): PaymentChannel {
	return {
		channelId: CHANNEL_ID,
		kind: PaymentChannelKind.Lease,
		leaseId: LEASE_ID,
		sandboxId: SANDBOX_ID,
		servicePeriodStart: null,
		signingMode,
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
	};
}

interface FakeResponse {
	status: number;
	body: unknown;
}

interface FakeApi {
	pending: () => FakeResponse;
	channel: () => FakeResponse;
	sandbox: () => FakeResponse;
	escrowAddress: () => string;
	submissions: SubmitVoucherSignature[];
	pendingRequests: number;
	channelRequests: number;
	escrowRequests: number;
}

function fakeApi(overrides: Partial<FakeApi> = {}): FakeApi {
	const api: FakeApi = {
		pending: () => ({ status: HTTP_OK, body: pending() }),
		channel: () => ({ status: HTTP_OK, body: channel() }),
		sandbox: () => ({ status: HTTP_OK, body: { id: SANDBOX_ID } }),
		escrowAddress: () => ESCROW,
		submissions: [],
		pendingRequests: 0,
		channelRequests: 0,
		escrowRequests: 0,
		...overrides,
	};
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
		const request = input instanceof Request ? input : new Request(input);
		const path = new URL(request.url).pathname;
		const reply = ({ status, body }: FakeResponse) =>
			new Response(JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json' },
			});
		if (path === '/settlement/vouchers/pending') {
			api.pendingRequests += 1;
			return reply(api.pending());
		}
		if (path === `/settlement/channels/${CHANNEL_ID}`) {
			api.channelRequests += 1;
			return reply(api.channel());
		}
		if (path === '/settlement/escrow') {
			api.escrowRequests += 1;
			const account: EscrowAccount = {
				chainId: CHAIN_ID,
				escrowAddress: api.escrowAddress(),
				usdcAddress: USDC,
				fundingWalletAddress: CUSTOMER,
				balanceMicroUsd: '0',
				pendingWithdrawalMicroUsd: '0',
				withdrawalReadyAt: null,
				blocked: false,
				indexedThroughBlock: null,
			};
			return reply({ status: HTTP_OK, body: account });
		}
		if (path === `/sandbox/${SANDBOX_ID}`) {
			return reply(api.sandbox());
		}
		if (path === '/settlement/vouchers' && request.method === 'POST') {
			const body = (await request.json()) as SubmitVoucherSignature;
			api.submissions.push(body);
			return reply({ status: HTTP_OK, body: {} });
		}
		return reply({ status: HTTP_NOT_FOUND, body: { message: path } });
	});
	return api;
}

interface SignerHarness {
	signer: VoucherSigner;
	errors: Error[];
}

function signer(options: Partial<VoucherSignerOptions> = {}): SignerHarness {
	const errors: Error[] = [];
	const client = createApiClient(
		{ apiKey: 'api-key', apiUrl: API_URL },
		'0.0.0-test'
	);
	return {
		errors,
		signer: new VoucherSigner(client, {
			sessionKey: generateSessionKey().privateKey,
			fundingWallet: CUSTOMER,
			policy: { maxHourlySpend: 1_000_000n },
			onError: (error) => errors.push(error),
			pollIntervalMilliseconds: POLL_INTERVAL_MILLISECONDS,
			...options,
		}),
	};
}

describe('VoucherSigner', () => {
	beforeEach(() => {
		vi.useFakeTimers({ now: NOW });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('signs verified vouchers with the session key and submits them', async () => {
		const api = fakeApi();
		const { signer: voucherSigner, errors } = signer();

		voucherSigner.start();
		await vi.advanceTimersByTimeAsync(0);
		await voucherSigner.stop();

		expect(errors).toEqual([]);
		expect(api.submissions).toHaveLength(1);
		const [submission] = api.submissions;
		expect(submission?.signer).toBe(voucherSigner.address);
		const entry = pending().vouchers[0];
		if (!(submission && entry)) throw new Error('missing submission');
		await expect(
			recoverVoucherSigner(
				escrowDomain(CHAIN_ID, ESCROW),
				parseVoucher(entry),
				submission.signature as Hex
			)
		).resolves.toBe(voucherSigner.address);
	});

	it('leaves channels of Snapflow delegated signer alone', async () => {
		const api = fakeApi({
			channel: () => ({
				status: HTTP_OK,
				body: channel(VoucherSigningMode.Delegated),
			}),
		});
		const { signer: voucherSigner, errors } = signer();

		voucherSigner.start();
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MILLISECONDS);
		await voucherSigner.stop();

		expect(api.pendingRequests).toBe(2);
		expect(api.submissions).toEqual([]);
		expect(errors).toEqual([]);
	});

	it('follows an escrow change after fetching the escrow account again', async () => {
		let moved = false;
		const api = fakeApi({
			pending: () => ({
				status: HTTP_OK,
				body: moved ? pending('800000', 2, OTHER_ESCROW) : pending(),
			}),
			escrowAddress: () => (moved ? OTHER_ESCROW : ESCROW),
		});
		const { signer: voucherSigner, errors } = signer();

		voucherSigner.start();
		await vi.advanceTimersByTimeAsync(0);
		moved = true;
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MILLISECONDS);
		await voucherSigner.stop();

		expect(errors).toEqual([]);
		expect(api.escrowRequests).toBe(2);
		expect(api.channelRequests).toBe(1);
		expect(api.submissions).toHaveLength(2);
	});

	it('refuses vouchers for an escrow Snapflow does not report', async () => {
		const api = fakeApi({
			pending: () => ({
				status: HTTP_OK,
				body: pending('800000', 1, OTHER_ESCROW),
			}),
		});
		const { signer: voucherSigner, errors } = signer();

		voucherSigner.start();
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MILLISECONDS * 2);
		await voucherSigner.stop();

		expect(api.escrowRequests).toBe(1);
		expect(api.submissions).toEqual([]);
		expect(errors).toHaveLength(1);
		expect((errors[0] as SnapflowVoucherRejectedError).reason).toBe(
			VoucherRejectionReason.DomainMismatch
		);
	});

	it('forgets channels that stop showing up in the pending vouchers', async () => {
		let listed = true;
		const api = fakeApi({
			pending: () => ({
				status: HTTP_OK,
				body: listed ? pending() : { domain: DOMAIN, vouchers: [] },
			}),
		});
		const { signer: voucherSigner } = signer({
			pollIntervalMilliseconds: HOUR_MILLISECONDS,
		});

		voucherSigner.start();
		await vi.advanceTimersByTimeAsync(0);
		listed = false;
		await vi.advanceTimersByTimeAsync(
			CHANNEL_RETENTION_MILLISECONDS + HOUR_MILLISECONDS
		);
		listed = true;
		await vi.advanceTimersByTimeAsync(HOUR_MILLISECONDS);
		await voucherSigner.stop();

		expect(api.channelRequests).toBe(2);
	});

	it('reports a voucher beyond the policy once and never signs it', async () => {
		const api = fakeApi({
			pending: () => ({ status: HTTP_OK, body: pending('5000000') }),
		});
		const { signer: voucherSigner, errors } = signer();

		voucherSigner.start();
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MILLISECONDS * 2);
		await voucherSigner.stop();

		expect(api.pendingRequests).toBe(3);
		expect(api.submissions).toEqual([]);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toBeInstanceOf(SnapflowVoucherRejectedError);
		expect((errors[0] as SnapflowVoucherRejectedError).reason).toBe(
			VoucherRejectionReason.HourlyRateExceeded
		);
	});

	it('refuses vouchers of a sandbox the organization cannot see', async () => {
		const api = fakeApi({
			sandbox: () => ({ status: HTTP_NOT_FOUND, body: { message: 'gone' } }),
		});
		const { signer: voucherSigner, errors } = signer();

		voucherSigner.start();
		await vi.advanceTimersByTimeAsync(0);
		await voucherSigner.stop();

		expect(api.submissions).toEqual([]);
		expect((errors[0] as SnapflowVoucherRejectedError).reason).toBe(
			VoucherRejectionReason.SandboxNotOwned
		);
	});

	it('backs off exponentially while the API fails and recovers afterwards', async () => {
		let failing = true;
		const api = fakeApi({
			pending: () =>
				failing
					? { status: HTTP_SERVER_ERROR, body: { message: 'down' } }
					: { status: HTTP_OK, body: pending() },
		});
		const { signer: voucherSigner, errors } = signer();

		voucherSigner.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(api.pendingRequests).toBe(1);
		await vi.advanceTimersByTimeAsync(FIRST_BACKOFF_MILLISECONDS);
		expect(api.pendingRequests).toBe(2);
		await vi.advanceTimersByTimeAsync(FIRST_BACKOFF_MILLISECONDS);
		expect(api.pendingRequests).toBe(2);
		failing = false;
		await vi.advanceTimersByTimeAsync(FIRST_BACKOFF_MILLISECONDS);
		await voucherSigner.stop();

		expect(api.pendingRequests).toBe(3);
		expect(errors).toHaveLength(2);
		expect(api.submissions).toHaveLength(1);
	});

	it('stops polling when its signal aborts', async () => {
		const api = fakeApi();
		const controller = new AbortController();
		const { signer: voucherSigner } = signer({ signal: controller.signal });

		voucherSigner.start();
		await vi.advanceTimersByTimeAsync(0);
		controller.abort();
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MILLISECONDS * 2);

		expect(voucherSigner.running).toBe(false);
		expect(api.pendingRequests).toBe(1);
		await expect(voucherSigner.stop()).resolves.toBeUndefined();
	});

	it('stops and rejects stop() when the error callback throws', async () => {
		fakeApi({
			pending: () => ({ status: HTTP_SERVER_ERROR, body: { message: 'down' } }),
		});
		const failure = new Error('callback failed');
		const { signer: voucherSigner } = signer({
			onError: () => {
				throw failure;
			},
		});

		voucherSigner.start();
		await vi.advanceTimersByTimeAsync(0);

		expect(voucherSigner.running).toBe(false);
		await expect(voucherSigner.stop()).rejects.toBe(failure);
	});
});
