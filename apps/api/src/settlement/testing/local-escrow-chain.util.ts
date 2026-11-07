/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { execFile, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
import { z } from 'zod';

const CONTRACTS_PROJECT = join('apps', 'contracts');
const FOUNDRY_CONFIG = 'foundry.toml';
const CONTRACT_DEPENDENCIES = 'dependencies';
const FOUNDRY_TOOLS = ['anvil', 'forge'] as const;
const DEPLOY_SCRIPT = 'DeployLocal.s.sol';
const BROADCAST_FILE = 'run-latest.json';
const ANVIL_HOST = '127.0.0.1';
const ANVIL_ACCOUNT_COUNT = 10;
const ANVIL_TIMEOUT_MILLISECONDS = 30_000;
const DEPLOYER_INDEX = 0;
const FEE_RECIPIENT_INDEX = 1;
const FIRST_TEST_ACCOUNT_INDEX = 2;
// The maximum the escrow allows, so every markup the API charges fits.
const FEE_CAP_BASIS_POINTS = 3_000;
const DISPUTE_WINDOW_SECONDS = 3_600;
const FUNDING_MICRO_USD = 1_000_000_000n;

const execFileAsync = promisify(execFile);

// Only the script's named return values are read, so the deploy can change
// how it deploys without breaking the tests.
const deployReturnsSchema = z.object({
	returns: z.object({
		escrow: z.object({ value: z.string() }),
		usdc: z.object({ value: z.string() }),
	}),
});

// Tests run bundled from dist at varying depths, so the contracts project is
// found by walking up to the workspace that contains it.
function findContractsDirectory(): string | undefined {
	for (let directory = import.meta.dirname; ; directory = dirname(directory)) {
		const candidate = join(directory, CONTRACTS_PROJECT);
		if (existsSync(join(candidate, FOUNDRY_CONFIG))) return candidate;
		if (dirname(directory) === directory) return undefined;
	}
}

const CONTRACTS_DIRECTORY = findContractsDirectory();

// Chain tests skip, like database tests without DATABASE_URL, on machines
// without Foundry or the installed contract dependencies.
export function localEscrowChainSkipReason(): string | false {
	const missingTool = FOUNDRY_TOOLS.find(
		(tool) => spawnSync(tool, ['--version']).status !== 0
	);
	if (missingTool) return `Foundry's ${missingTool} is not installed`;
	if (!CONTRACTS_DIRECTORY) return `${CONTRACTS_PROJECT} was not found`;
	if (!existsSync(join(CONTRACTS_DIRECTORY, CONTRACT_DEPENDENCIES))) {
		return `${CONTRACTS_PROJECT} dependencies are not installed (forge soldeer install)`;
	}
	return false;
}

async function deployEscrow(
	contractsDirectory: string,
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
				cwd: contractsDirectory,
				env: {
					...process.env,
					// forge locks per script and chain id inside its cache, so test
					// files deploying in parallel each get their own build, cache and
					// broadcast directories.
					FOUNDRY_OUT: join(workDirectory, 'out'),
					FOUNDRY_CACHE_PATH: join(workDirectory, 'cache'),
					FOUNDRY_BROADCAST: broadcastDirectory,
					ESCROW_FEE_RECIPIENT: feeRecipient,
					ESCROW_FEE_CAP_BPS: String(FEE_CAP_BASIS_POINTS),
					ESCROW_DISPUTE_WINDOW_SECONDS: String(DISPUTE_WINDOW_SECONDS),
					LOCAL_FUNDED_ACCOUNTS: funded.join(','),
					LOCAL_FUNDING_AMOUNT: String(FUNDING_MICRO_USD),
				},
			}
		);
		const broadcast = await readFile(
			join(
				broadcastDirectory,
				DEPLOY_SCRIPT,
				String(foundry.id),
				BROADCAST_FILE
			),
			'utf8'
		);
		const { returns } = deployReturnsSchema.parse(JSON.parse(broadcast));
		return {
			escrowAddress: getAddress(returns.escrow.value),
			usdcAddress: getAddress(returns.usdc.value),
		};
	} finally {
		await rm(workDirectory, { recursive: true, force: true });
	}
}

// Starts an anvil chain of its own on a free port, deploys the escrow and a
// mock USDC with apps/contracts' DeployLocal script and funds every test
// account with USDC. Its accounts are unlocked, so no key is needed.
export async function startLocalEscrowChain() {
	if (!CONTRACTS_DIRECTORY) {
		throw new Error(`${CONTRACTS_PROJECT} was not found`);
	}
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
		const walletClient = createWalletClient({ chain: foundry, transport });
		const addresses = await walletClient.getAddresses();
		const deployer = addresses[DEPLOYER_INDEX];
		const feeRecipient = addresses[FEE_RECIPIENT_INDEX];
		const accounts = addresses.slice(FIRST_TEST_ACCOUNT_INDEX);
		if (!deployer || !feeRecipient) {
			throw new Error(`anvil started with ${addresses.length} accounts`);
		}
		const deployed = await deployEscrow(
			CONTRACTS_DIRECTORY,
			instance.url,
			deployer,
			feeRecipient,
			accounts
		);
		return {
			...deployed,
			rpcUrl: instance.url,
			publicClient,
			walletClient,
			feeRecipient,
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
export function testAccount(chain: LocalEscrowChain, index: number) {
	const account = chain.accounts[index];
	if (!account) throw new Error(`The local chain has no test account ${index}`);
	return account;
}
