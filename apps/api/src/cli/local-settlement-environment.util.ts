/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { readFile } from 'node:fs/promises';
import { getAddress } from 'viem';
import { z } from 'zod';
import { SETTLEMENT_CHAIN_ID } from '../config/constants/settlement-chain.constants';

// Written by moon run contracts:dev-chain-state, which also saves the chain
// the dev stack's anvil service boots from.
const LOCAL_DEPLOYMENT_REGISTRY = 'apps/contracts/deployments/31337.json';
// The anvil service in .devcontainer/compose/chain.yml.
const LOCAL_SETTLEMENT_RPC_URL = 'http://anvil:8545';

const localDeploymentSchema = z.object({
	chainId: z.literal(SETTLEMENT_CHAIN_ID.LOCAL),
	escrow: z.object({
		address: z.string(),
		blockNumber: z.number().int().nonnegative(),
		constructorArgs: z.object({ token: z.string() }),
	}),
});

// The settlement variables that point the API at the dev stack's chain.
export async function localSettlementEnvironment(): Promise<
	Record<string, string>
> {
	const { chainId, escrow } = localDeploymentSchema.parse(
		JSON.parse(await readFile(LOCAL_DEPLOYMENT_REGISTRY, 'utf8'))
	);
	return {
		SETTLEMENT_CHAIN_ID: String(chainId),
		SETTLEMENT_RPC_URL: LOCAL_SETTLEMENT_RPC_URL,
		SETTLEMENT_ESCROW_ADDRESS: getAddress(escrow.address),
		SETTLEMENT_ESCROW_DEPLOYMENT_BLOCK: String(escrow.blockNumber),
		SETTLEMENT_USDC_ADDRESS: getAddress(escrow.constructorArgs.token),
	};
}
