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

import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	ContractFunctionExecutionError,
	ContractFunctionRevertedError,
	encodeErrorResult,
	getAddress,
	type Hash,
	parseSignature,
	recoverTypedDataAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { SnapflowEscrowError } from '../errors/settlement-error.js';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import { SettlementService } from '../settlement.js';
import { createApiClient } from '../snapflow/client-config.js';
import { Escrow } from './escrow.js';
import { PERMIT_LIFETIME_SECONDS } from './escrow-permit.js';
import type {
	EscrowPublicClient,
	EscrowWalletClient,
} from './escrow-transaction.js';
import { generateSessionKey } from './session-key.js';

const CHAIN_ID = 31_337;
const OTHER_CHAIN_ID = 8453;
const ESCROW = getAddress('0x4444444444444444444444444444444444444444');
const USDC = getAddress('0x5555555555555555555555555555555555555555');
const SIGNER = getAddress('0x6666666666666666666666666666666666666666');
const TRANSACTION_HASH: Hash = `0x${'ab'.repeat(32)}`;
const AMOUNT = 5_000_000n;
const BLOCK_TIMESTAMP = 1_800_000_000n;
const HTTP_OK = 200;
const customer = privateKeyToAccount(generateSessionKey().privateKey);

interface FakeChain {
	walletClient: EscrowWalletClient;
	publicClient: EscrowPublicClient;
	writes: {
		address: string;
		functionName: string;
		args?: readonly unknown[];
	}[];
}

function fakeChain(
	options: {
		allowance?: bigint;
		receiptStatus?: 'success' | 'reverted';
		simulationError?: Error;
		chainId?: number;
	} = {}
): FakeChain {
	const writes: FakeChain['writes'] = [];
	const chain = { id: options.chainId ?? CHAIN_ID };
	const walletClient = {
		chain,
		account: customer,
		writeContract: vi.fn(async (request: FakeChain['writes'][number]) => {
			writes.push({
				address: request.address,
				functionName: request.functionName,
				args: request.args,
			});
			return TRANSACTION_HASH;
		}),
		signTypedData: vi.fn(
			(request: Parameters<typeof customer.signTypedData>[0]) =>
				customer.signTypedData(request)
		),
	};
	const publicClient = {
		chain: { id: CHAIN_ID },
		simulateContract: vi.fn(async (request: FakeChain['writes'][number]) => {
			if (options.simulationError) throw options.simulationError;
			return { request };
		}),
		readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
			switch (functionName) {
				case 'allowance':
					return options.allowance ?? 0n;
				case 'nonces':
					return 0n;
				case 'balanceOf':
					return AMOUNT;
				case 'withdrawalOf':
					return { amount: 0n, readyAt: 0n };
				default:
					throw new Error(`unexpected read ${functionName}`);
			}
		}),
		getEip712Domain: vi.fn(async () => ({
			domain: { name: 'USD Coin', version: '1' },
		})),
		getBlock: vi.fn(async () => ({ timestamp: BLOCK_TIMESTAMP })),
		waitForTransactionReceipt: vi.fn(async () => ({
			status: options.receiptStatus ?? 'success',
			transactionHash: TRANSACTION_HASH,
		})),
	};
	return {
		walletClient: walletClient as unknown as EscrowWalletClient,
		publicClient: publicClient as unknown as EscrowPublicClient,
		writes,
	};
}

function escrowFor(chain: FakeChain): Escrow {
	return new Escrow({
		walletClient: chain.walletClient,
		publicClient: chain.publicClient,
		escrowAddress: ESCROW,
		usdcAddress: USDC,
	});
}

describe('Escrow', () => {
	afterEach(() => vi.restoreAllMocks());

	it('approves USDC when the allowance is short and then deposits', async () => {
		const chain = fakeChain({ allowance: AMOUNT - 1n });

		await escrowFor(chain).deposit(AMOUNT);

		expect(chain.writes).toEqual([
			{ address: USDC, functionName: 'approve', args: [ESCROW, AMOUNT] },
			{ address: ESCROW, functionName: 'deposit', args: [AMOUNT] },
		]);
	});

	it('deposits without approving when the allowance covers the amount', async () => {
		const chain = fakeChain({ allowance: AMOUNT });

		await escrowFor(chain).deposit(AMOUNT);

		expect(chain.writes.map(({ functionName }) => functionName)).toEqual([
			'deposit',
		]);
	});

	it('deposits with an EIP-2612 permit signed by the wallet', async () => {
		const chain = fakeChain();

		await escrowFor(chain).deposit(AMOUNT, { permit: true });

		const [write] = chain.writes;
		expect(write?.functionName).toBe('depositWithPermit');
		const [amount, deadline, v, r, s] = write?.args ?? [];
		expect(amount).toBe(AMOUNT);
		expect(deadline).toBe(BLOCK_TIMESTAMP + PERMIT_LIFETIME_SECONDS);
		const signature = vi.mocked(chain.walletClient.signTypedData).mock
			.results[0]?.value;
		const parsed = parseSignature(await signature);
		expect({ r, s, v }).toEqual({
			r: parsed.r,
			s: parsed.s,
			v: parsed.yParity + 27,
		});
		const request = vi.mocked(chain.walletClient.signTypedData).mock
			.calls[0]?.[0];
		if (!request) throw new Error('missing permit request');
		await expect(
			recoverTypedDataAddress({ ...request, signature: await signature })
		).resolves.toBe(customer.address);
	});

	it('reports a reverted receipt with its transaction hash', async () => {
		const chain = fakeChain({ receiptStatus: 'reverted' });

		const failure = escrowFor(chain).withdraw();

		await expect(failure).rejects.toBeInstanceOf(SnapflowEscrowError);
		await expect(failure).rejects.toMatchObject({
			transactionHash: TRANSACTION_HASH,
		});
	});

	it('names the custom error a refused transaction reverts with', async () => {
		const reverted = new ContractFunctionRevertedError({
			abi: snapflowEscrowAbi,
			functionName: 'requestWithdrawal',
			data: encodeErrorResult({
				abi: snapflowEscrowAbi,
				errorName: 'InsufficientBalance',
				args: [customer.address, AMOUNT, 0n],
			}),
		});
		const chain = fakeChain({
			simulationError: new ContractFunctionExecutionError(reverted, {
				abi: snapflowEscrowAbi,
				functionName: 'requestWithdrawal',
				args: [AMOUNT],
			}),
		});

		await expect(
			escrowFor(chain).requestWithdrawal(AMOUNT)
		).rejects.toMatchObject({ contractError: 'InsufficientBalance' });
	});

	it('reads the balance and pending withdrawal from the contract', async () => {
		await expect(escrowFor(fakeChain()).readBalance()).resolves.toEqual({
			balance: AMOUNT,
			withdrawal: { amount: 0n, readyAt: 0n },
		});
	});

	it('refuses clients on different chains and limits that are not positive', () => {
		expect(() => escrowFor(fakeChain({ chainId: OTHER_CHAIN_ID }))).toThrow(
			SnapflowValidationError
		);
		expect(() =>
			escrowFor(fakeChain()).authorizeSessionKey(SIGNER, {
				spendCap: 0n,
				hourlyCap: 1n,
				expiry: BLOCK_TIMESTAMP,
			})
		).toThrow(SnapflowValidationError);
	});
});

describe('SettlementService', () => {
	const delegation = {
		chainId: CHAIN_ID,
		escrowAddress: ESCROW,
		signerAddress: SIGNER,
		fundingWalletAddress: customer.address,
		sessionKey: null,
		suggestedHourlyCapMicroUsd: '3000000',
		suggestedSpendCapMicroUsd: '90000000',
		suggestedExpiry: String(BLOCK_TIMESTAMP),
	};
	const escrowAccount = {
		chainId: CHAIN_ID,
		escrowAddress: ESCROW,
		usdcAddress: USDC,
		fundingWalletAddress: customer.address,
		balanceMicroUsd: '0',
		pendingWithdrawalMicroUsd: '0',
		withdrawalReadyAt: null,
		blocked: false,
		indexedThroughBlock: null,
	};

	function settlement(body: unknown): SettlementService {
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			async () =>
				new Response(JSON.stringify(body), {
					status: HTTP_OK,
					headers: { 'Content-Type': 'application/json' },
				})
		);
		return new SettlementService(
			createApiClient(
				{ apiKey: 'api-key', apiUrl: 'https://api.snapflow.test' },
				'0.0.0-test'
			)
		);
	}

	afterEach(() => vi.restoreAllMocks());

	it('authorizes the delegated signer with the suggested limits', async () => {
		const chain = fakeChain();

		await settlement(delegation).authorizeDelegatedSigner(escrowFor(chain), {
			hourlyCap: 1n,
		});

		expect(chain.writes).toEqual([
			{
				address: ESCROW,
				functionName: 'setSessionKey',
				args: [SIGNER, 90_000_000n, 1n, BLOCK_TIMESTAMP],
			},
		]);
	});

	it('refuses to authorize the signer for a wallet that is not the funding wallet', async () => {
		await expect(
			settlement({
				...delegation,
				fundingWalletAddress: null,
			}).authorizeDelegatedSigner(escrowFor(fakeChain()))
		).rejects.toBeInstanceOf(SnapflowValidationError);
	});

	it('binds the escrow Snapflow settles on and refuses another chain', async () => {
		const bound = await settlement(escrowAccount).escrow(fakeChain());
		expect(bound.escrowAddress).toBe(ESCROW);
		expect(bound.usdcAddress).toBe(USDC);

		await expect(
			settlement({ ...escrowAccount, chainId: OTHER_CHAIN_ID }).escrow(
				fakeChain()
			)
		).rejects.toBeInstanceOf(SnapflowValidationError);
	});
});
