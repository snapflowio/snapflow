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
	type ChildProcess,
	execFile,
	spawn,
	spawnSync,
} from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
	PaymentChannelKind,
	PaymentChannelState,
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
	type Address,
	createPublicClient,
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
import type {
	EscrowPublicClient,
	EscrowWalletClient,
} from './escrow-transaction.js';
import { generateSessionKey } from './session-key.js';
import { VoucherSigner } from './voucher-signer.js';
import { parseVoucher } from './voucher-verification.js';

const CONTRACTS_DIRECTORY = fileURLToPath(
	new URL('../../../../apps/contracts', import.meta.url)
);
const LISTENING_PATTERN = /Listening on (\S+)/;
const DEPLOYED_PATTERN = /(USDC|SnapflowEscrow) (0x[0-9a-fA-F]{40})/g;
const CHAIN_TIMEOUT_MILLISECONDS = 300_000;
const ANVIL_START_TIMEOUT_MILLISECONDS = 30_000;
const FUNDING_AMOUNT = 100_000_000n;
const DEPOSIT_AMOUNT = 10_000_000n;
const PERMIT_DEPOSIT_AMOUNT = 1_000_000n;
const WITHDRAWAL_AMOUNT = 2_000_000n;
const SPEND_CAP = 5_000_000n;
const HOURLY_CAP = 2_000_000n;
const HOST_AMOUNT = 800_000n;
const FEE_AMOUNT = 200_000n;
const FEE_CAP_BASIS_POINTS = 3_000;
const SECONDS_PER_HOUR = 3_600n;
const DISPUTE_WINDOW_SECONDS = SECONDS_PER_HOUR;
const MILLISECONDS_PER_SECOND = 1_000;
const HTTP_OK = 200;
const DEPLOYER_INDEX = 0;
const CUSTOMER_INDEX = 1;
const HOST_INDEX = 2;
const FEE_RECIPIENT_INDEX = 3;
const LEASE_ID = 'chain-lease';
const SANDBOX_ID = 'chain-sandbox';

const execFileAsync = promisify(execFile);

function foundryAvailable(): boolean {
	return (
		['anvil', 'forge'].every(
			(tool) => spawnSync(tool, ['--version']).status === 0
		) && existsSync(join(CONTRACTS_DIRECTORY, 'dependencies'))
	);
}

function startAnvil(): Promise<{ anvil: ChildProcess; rpcUrl: string }> {
	const anvil = spawn('anvil', ['--port', '0'], {
		stdio: ['ignore', 'pipe', 'inherit'],
	});
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new Error('anvil did not start')),
			ANVIL_START_TIMEOUT_MILLISECONDS
		);
		let output = '';
		anvil.once('error', reject);
		anvil.stdout?.on('data', (chunk: Buffer) => {
			output += chunk.toString();
			const address = LISTENING_PATTERN.exec(output)?.[1];
			if (address) {
				clearTimeout(timeout);
				resolve({ anvil, rpcUrl: `http://${address}` });
			}
		});
	});
}

describe.runIf(foundryAvailable())('Escrow on a local anvil chain', () => {
	let anvil: ChildProcess | undefined;
	let broadcastDirectory: string | undefined;
	let rpcUrl: string;
	let accounts: Address[];
	let publicClient: EscrowPublicClient;
	let walletClient: EscrowWalletClient;
	let escrow: Escrow;

	function account(index: number): Address {
		const address = accounts[index];
		if (!address) throw new Error(`anvil has no account ${index}`);
		return address;
	}

	beforeAll(async () => {
		const started = await startAnvil();
		anvil = started.anvil;
		rpcUrl = started.rpcUrl;
		const transport = http(rpcUrl);
		publicClient = createPublicClient({ chain: foundry, transport });
		accounts = await createWalletClient({
			chain: foundry,
			transport,
		}).getAddresses();
		broadcastDirectory = await mkdtemp(join(tmpdir(), 'snapflow-broadcast-'));
		const { stdout } = await execFileAsync(
			'forge',
			[
				'script',
				'script/DeployLocal.s.sol',
				'--rpc-url',
				rpcUrl,
				'--broadcast',
				'--unlocked',
				'--sender',
				account(DEPLOYER_INDEX),
			],
			{
				cwd: CONTRACTS_DIRECTORY,
				env: {
					// biome-ignore lint/style/noProcessEnv: forge needs the inherited PATH and HOME besides the deploy settings
					...process.env,
					FOUNDRY_BROADCAST: broadcastDirectory,
					ESCROW_FEE_RECIPIENT: account(FEE_RECIPIENT_INDEX),
					ESCROW_FEE_CAP_BPS: String(FEE_CAP_BASIS_POINTS),
					ESCROW_DISPUTE_WINDOW_SECONDS: String(DISPUTE_WINDOW_SECONDS),
					LOCAL_FUNDED_ACCOUNTS: account(CUSTOMER_INDEX),
					LOCAL_FUNDING_AMOUNT: String(FUNDING_AMOUNT),
				},
			}
		);
		const deployed = new Map(
			[...stdout.matchAll(DEPLOYED_PATTERN)].map(([, name, address]) => [
				name,
				getAddress(address ?? ''),
			])
		);
		const escrowAddress = deployed.get('SnapflowEscrow');
		const usdcAddress = deployed.get('USDC');
		if (!(escrowAddress && usdcAddress)) {
			throw new Error(`DeployLocal printed no addresses:\n${stdout}`);
		}
		walletClient = createWalletClient({
			account: account(CUSTOMER_INDEX),
			chain: foundry,
			transport,
		});
		escrow = new Escrow({
			walletClient,
			publicClient,
			escrowAddress,
			usdcAddress,
		});
	}, CHAIN_TIMEOUT_MILLISECONDS);

	afterAll(async () => {
		anvil?.kill();
		if (broadcastDirectory) {
			await rm(broadcastDirectory, { recursive: true, force: true });
		}
	});

	afterEach(() => vi.restoreAllMocks());

	it('deposits with an approval and with a permit', async () => {
		await escrow.deposit(DEPOSIT_AMOUNT);
		await escrow.deposit(PERMIT_DEPOSIT_AMOUNT, { permit: true });

		const { balance } = await escrow.readBalance();
		expect(balance).toBe(DEPOSIT_AMOUNT + PERMIT_DEPOSIT_AMOUNT);
	});

	it('claims a voucher the VoucherSigner signed with an authorized session key', async () => {
		const sessionKey = generateSessionKey();
		const customer = account(CUSTOMER_INDEX);
		const host = account(HOST_INDEX);
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
		const entry = {
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
			},
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
			},
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
			},
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
		await testClient.increaseTime({ seconds: Number(DISPUTE_WINDOW_SECONDS) });
		await testClient.mine({ blocks: 1 });
		await escrow.withdraw();

		expect((await escrow.readBalance()).balance).toBe(
			balance - WITHDRAWAL_AMOUNT
		);
	});
});
