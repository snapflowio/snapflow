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
	type PendingVoucher,
	type PendingVouchers,
	type SubmitVoucherSignature,
	VoucherSigningMode,
} from '@snapflow/api-client';
import {
	channelIdFor,
	ESCROW_DOMAIN_NAME,
	ESCROW_DOMAIN_VERSION,
	snapflowEscrowAbi,
} from '@snapflow/contracts';
import {
	createTestClient,
	createWalletClient,
	erc20Abi,
	getAddress,
	type Hex,
	http,
} from 'viem';
import { foundry } from 'viem/chains';
import { createApiClient } from '../snapflow/client-config.js';
import { Escrow } from './escrow.js';
import { generateSessionKey } from './session-key.js';
import {
	type LocalEscrowChain,
	localEscrowChainAvailable,
	startLocalEscrowChain,
	testAccount,
} from './testing/local-escrow-chain.js';
import { VoucherSigner } from './voucher-signer.js';
import { parseVoucher } from './voucher-verification.js';

const CHAIN_TIMEOUT_MILLISECONDS = 300_000;
const DEPOSIT_AMOUNT = 10_000_000n;
const PERMIT_DEPOSIT_AMOUNT = 1_000_000n;
const WITHDRAWAL_AMOUNT = 2_000_000n;
const SPEND_CAP = 5_000_000n;
const HOURLY_CAP = 2_000_000n;
const HOST_AMOUNT = 800_000n;
const FEE_AMOUNT = 200_000n;
const SECONDS_PER_HOUR = 3_600n;
const MILLISECONDS_PER_SECOND = 1_000;
const HTTP_OK = 200;
const CUSTOMER_INDEX = 0;
const HOST_INDEX = 1;
const LEASE_ID = 'chain-lease';
const SANDBOX_ID = 'chain-sandbox';

describe.runIf(localEscrowChainAvailable())(
	'Escrow on a local anvil chain',
	() => {
		let chain: LocalEscrowChain;
		let rpcUrl: string;
		let publicClient: LocalEscrowChain['publicClient'];
		let escrow: Escrow;

		beforeAll(async () => {
			chain = await startLocalEscrowChain();
			({ rpcUrl, publicClient } = chain);
			escrow = new Escrow({
				walletClient: createWalletClient({
					account: testAccount(chain, CUSTOMER_INDEX),
					chain: foundry,
					transport: http(rpcUrl),
				}),
				publicClient,
				escrowAddress: chain.escrowAddress,
				usdcAddress: chain.usdcAddress,
			});
		}, CHAIN_TIMEOUT_MILLISECONDS);

		afterAll(() => chain?.stop());

		afterEach(() => vi.restoreAllMocks());

		it('deposits with an approval and with a permit', async () => {
			await escrow.deposit(DEPOSIT_AMOUNT);
			await escrow.deposit(PERMIT_DEPOSIT_AMOUNT, { permit: true });

			const { balance } = await escrow.readBalance();
			expect(balance).toBe(DEPOSIT_AMOUNT + PERMIT_DEPOSIT_AMOUNT);
		});

		it('claims a voucher the VoucherSigner signed with an authorized session key', async () => {
			const sessionKey = generateSessionKey();
			const customer = testAccount(chain, CUSTOMER_INDEX);
			const host = testAccount(chain, HOST_INDEX);
			const block = await publicClient.getBlock();
			await escrow.authorizeSessionKey(sessionKey.account.address, {
				spendCap: SPEND_CAP,
				hourlyCap: HOURLY_CAP,
				expiry: block.timestamp + SECONDS_PER_HOUR,
			});
			const channelId = channelIdFor(customer, host, LEASE_ID);
			const openedAt = new Date(
				Number(block.timestamp - SECONDS_PER_HOUR) * MILLISECONDS_PER_SECOND
			);
			const entry: PendingVoucher = {
				channelId,
				kind: PaymentChannelKind.Lease,
				sandboxId: SANDBOX_ID,
				leaseId: LEASE_ID,
				servicePeriodStart: null,
				voucher: {
					sequence: 1,
					message: {
						channelId,
						customer,
						host,
						hostAmount: String(HOST_AMOUNT),
						feeAmount: String(FEE_AMOUNT),
						serviceAmount: '0',
						sequence: '1',
						expiry: String(block.timestamp + SECONDS_PER_HOUR),
					},
					issuedAt: openedAt.toISOString(),
					expiresAt: openedAt.toISOString(),
					signerAddress: null,
					signature: null,
					signedAt: null,
				},
			};
			const api: Record<string, unknown> = {
				'/settlement/vouchers/pending': {
					domain: {
						name: ESCROW_DOMAIN_NAME,
						version: ESCROW_DOMAIN_VERSION,
						chainId: foundry.id,
						verifyingContract: escrow.escrowAddress,
					},
					vouchers: [entry],
				} satisfies PendingVouchers,
				[`/settlement/channels/${channelId}`]: {
					channelId,
					kind: PaymentChannelKind.Lease,
					leaseId: LEASE_ID,
					sandboxId: SANDBOX_ID,
					servicePeriodStart: null,
					signingMode: VoucherSigningMode.Client,
					state: PaymentChannelState.Open,
					customerAddress: customer,
					hostAddress: host,
					openedAt: openedAt.toISOString(),
					closedAt: null,
					coveredAt: openedAt.toISOString(),
					voucherError: null,
					claimedSequence: 0,
					claimError: null,
					latestVoucher: null,
				} satisfies PaymentChannel,
				[`/sandbox/${SANDBOX_ID}`]: { id: SANDBOX_ID },
				'/settlement/escrow': {
					chainId: foundry.id,
					escrowAddress: escrow.escrowAddress,
					usdcAddress: escrow.usdcAddress,
					fundingWalletAddress: customer,
					balanceMicroUsd: '0',
					pendingWithdrawalMicroUsd: '0',
					withdrawalReadyAt: null,
					blocked: false,
					indexedThroughBlock: null,
				} satisfies EscrowAccount,
			};
			const submitted = Promise.withResolvers<SubmitVoucherSignature>();
			const realFetch = globalThis.fetch;
			vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
				const request =
					input instanceof Request ? input : new Request(input, init);
				if (request.url.startsWith(rpcUrl)) return realFetch(input, init);
				const path = new URL(request.url).pathname;
				if (request.method === 'POST' && path === '/settlement/vouchers') {
					submitted.resolve((await request.json()) as SubmitVoucherSignature);
					return Response.json({}, { status: HTTP_OK });
				}
				return Response.json(api[path], { status: HTTP_OK });
			});
			const errors: Error[] = [];
			const signer = new VoucherSigner(
				createApiClient(
					{ apiKey: 'api-key', apiUrl: 'https://api.snapflow.test' },
					'0.0.0-test'
				),
				{
					sessionKey: sessionKey.privateKey,
					fundingWallet: customer,
					policy: { maxHourlySpend: HOURLY_CAP },
					onError: (error) => errors.push(error),
				}
			);

			signer.start();
			const submission = await submitted.promise;
			await signer.stop();

			expect(errors).toEqual([]);
			const hostBalance = () =>
				publicClient.readContract({
					address: escrow.usdcAddress,
					abi: erc20Abi,
					functionName: 'balanceOf',
					args: [host],
				});
			const before = await hostBalance();
			const hostWallet = createWalletClient({
				account: host,
				chain: foundry,
				transport: http(rpcUrl),
			});
			const hash = await hostWallet.writeContract({
				address: escrow.escrowAddress,
				abi: snapflowEscrowAbi,
				functionName: 'claim',
				args: [
					{
						voucher: parseVoucher(entry),
						signer: getAddress(submission.signer),
						signature: submission.signature as Hex,
					},
				],
			});
			const receipt = await publicClient.waitForTransactionReceipt({ hash });

			expect(receipt.status).toBe('success');
			expect((await hostBalance()) - before).toBe(HOST_AMOUNT);
			await escrow.revokeSessionKey(sessionKey.account.address);
		});

		it('requests, cancels and completes a withdrawal after the dispute window', async () => {
			const testClient = createTestClient({
				chain: foundry,
				mode: 'anvil',
				transport: http(rpcUrl),
			});
			const { balance } = await escrow.readBalance();

			await escrow.requestWithdrawal(WITHDRAWAL_AMOUNT);
			await escrow.cancelWithdrawal();
			expect((await escrow.readBalance()).withdrawal.amount).toBe(0n);
			await escrow.requestWithdrawal(WITHDRAWAL_AMOUNT);
			await expect(escrow.withdraw()).rejects.toMatchObject({
				contractError: 'WithdrawalNotReady',
			});
			const disputeWindow = await publicClient.readContract({
				address: escrow.escrowAddress,
				abi: snapflowEscrowAbi,
				functionName: 'disputeWindow',
			});
			await testClient.increaseTime({ seconds: Number(disputeWindow) });
			await testClient.mine({ blocks: 1 });
			await escrow.withdraw();

			expect((await escrow.readBalance()).balance).toBe(
				balance - WITHDRAWAL_AMOUNT
			);
		});
	}
);
