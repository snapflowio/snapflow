/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Address, getAddress } from 'viem';

export interface IntegrationChain {
	rpcUrl: string;
	escrowAddress: Address;
	usdcAddress: Address;
}

// A local anvil chain with apps/contracts' DeployLocal script broadcast to
// it; chain tests skip without one. Its unlocked accounts send the
// transactions, so no key is needed.
export function integrationChain(): IntegrationChain | undefined {
	const rpcUrl = process.env.SETTLEMENT_INTEGRATION_RPC_URL;
	const escrowAddress = process.env.SETTLEMENT_INTEGRATION_ESCROW_ADDRESS;
	const usdcAddress = process.env.SETTLEMENT_INTEGRATION_USDC_ADDRESS;
	if (!rpcUrl || !escrowAddress || !usdcAddress) return undefined;
	return {
		rpcUrl,
		escrowAddress: getAddress(escrowAddress),
		usdcAddress: getAddress(usdcAddress),
	};
}
