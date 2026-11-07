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

import { execFile, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Instance, Pool } from 'prool';
import {
	type Address,
	createPublicClient,
	createWalletClient,
	getAddress,
	http,
} from 'viem';
import { foundry } from 'viem/chains';

const CONTRACTS_DIRECTORY = fileURLToPath(
	new URL('../../../../../apps/contracts', import.meta.url)
);
const FOUNDRY_TOOLS = ['anvil', 'forge'] as const;
const DEPLOY_SCRIPT = 'DeployLocal.s.sol';
const BROADCAST_FILE = 'run-latest.json';
const ANVIL_HOST = '127.0.0.1';
const ANVIL_ACCOUNT_COUNT = 10;
const ANVIL_TIMEOUT_MILLISECONDS = 30_000;
const DEPLOYER_INDEX = 0;
const FEE_RECIPIENT_INDEX = 1;
const FIRST_TEST_ACCOUNT_INDEX = 2;
// The maximum the escrow allows.
const FEE_CAP_BASIS_POINTS = 3_000;
const DISPUTE_WINDOW_SECONDS = 3_600;
const FUNDING_AMOUNT = 1_000_000_000n;

const execFileAsync = promisify(execFile);

// The chain test runs only where Foundry and the contract dependencies are
// installed.
export function localEscrowChainAvailable(): boolean {
	return (
		FOUNDRY_TOOLS.every(
			(tool) => spawnSync(tool, ['--version']).status === 0
		) && existsSync(join(CONTRACTS_DIRECTORY, 'dependencies'))
	);
}

// forge writes the script's named return values to its broadcast file; only
// those are read, so the deploy can change how it deploys.
async function deployEscrow(
	rpcUrl: string,
	deployer: Address,
	feeRecipient: Address,
	funded: readonly Address[]
) {
	const workDirectory = await mkdtemp(join(tmpdir(), 'snapflow-deploy-'));
	const broadcastDirectory = join(workDirectory, 'broadcast');
	try {
		await execFileAsync(
			'forge',
			[
				'script',
				join('script', DEPLOY_SCRIPT),
				'--rpc-url',
				rpcUrl,
				'--broadcast',
				'--unlocked',
				'--sender',
				deployer,
			],
			{
				cwd: CONTRACTS_DIRECTORY,
				env: {
					...process.env,
					// forge locks per script and chain id inside its cache, so
					// parallel runs each get their own build, cache and broadcast
					// directories.
					FOUNDRY_OUT: join(workDirectory, 'out'),
					FOUNDRY_CACHE_PATH: join(workDirectory, 'cache'),
					FOUNDRY_BROADCAST: broadcastDirectory,
					ESCROW_FEE_RECIPIENT: feeRecipient,
					ESCROW_FEE_CAP_BPS: String(FEE_CAP_BASIS_POINTS),
					ESCROW_DISPUTE_WINDOW_SECONDS: String(DISPUTE_WINDOW_SECONDS),
					LOCAL_FUNDED_ACCOUNTS: funded.join(','),
					LOCAL_FUNDING_AMOUNT: String(FUNDING_AMOUNT),
				},
			}
		);
		const broadcast: {
			returns?: Partial<Record<'escrow' | 'usdc', { value: string }>>;
		} = JSON.parse(
			await readFile(
				join(
					broadcastDirectory,
					DEPLOY_SCRIPT,
					String(foundry.id),
					BROADCAST_FILE
				),
				'utf8'
			)
		);
		const escrow = broadcast.returns?.escrow?.value;
		const usdc = broadcast.returns?.usdc?.value;
		if (!(escrow && usdc)) {
			throw new Error(`${DEPLOY_SCRIPT} returned no escrow and USDC`);
		}
		return { escrowAddress: getAddress(escrow), usdcAddress: getAddress(usdc) };
	} finally {
		await rm(workDirectory, { recursive: true, force: true });
	}
}

// Starts an anvil chain of its own on a free port, deploys the escrow and a
// mock USDC with apps/contracts' DeployLocal script and funds every test
// account with USDC. Its accounts are unlocked, so no key is needed.
export async function startLocalEscrowChain() {
	const pool = Pool.create({
		instance: Instance.anvil(
			{ host: ANVIL_HOST, accounts: ANVIL_ACCOUNT_COUNT },
			{ timeout: ANVIL_TIMEOUT_MILLISECONDS }
		),
		limit: 1,
	});
	try {
		const { instance } = await pool.acquire();
		const transport = http(instance.url);
		const publicClient = createPublicClient({ chain: foundry, transport });
		const addresses = await createWalletClient({
			chain: foundry,
			transport,
		}).getAddresses();
		const deployer = addresses[DEPLOYER_INDEX];
		const feeRecipient = addresses[FEE_RECIPIENT_INDEX];
		const accounts = addresses.slice(FIRST_TEST_ACCOUNT_INDEX);
		if (!deployer || !feeRecipient) {
			throw new Error(`anvil started with ${addresses.length} accounts`);
		}
		const deployed = await deployEscrow(
			instance.url,
			deployer,
			feeRecipient,
			accounts
		);
		return {
			...deployed,
			rpcUrl: instance.url,
			publicClient,
			accounts,
			stop: () => pool.close(),
		};
	} catch (error) {
		await pool.close();
		throw error;
	}
}

export type LocalEscrowChain = Awaited<
	ReturnType<typeof startLocalEscrowChain>
>;

// The funded test account at index, failing loudly when a test asks for more
// accounts than the chain has.
export function testAccount(chain: LocalEscrowChain, index: number): Address {
	const account = chain.accounts[index];
	if (!account) throw new Error(`The local chain has no test account ${index}`);
	return account;
}
