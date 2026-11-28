/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';
import {
	DEVELOPMENT_ONLY,
	PRODUCTION_ONLY,
} from '../../constants/deployment-environment.constants';
import {
	DEFAULT_INDEXER_RANGES_PER_RUN,
	DEFAULT_LOG_BLOCK_RANGE,
	DEFAULT_SANCTIONS_LIST_URL,
	MAXIMUM_INDEXER_RANGES_PER_RUN,
	MAXIMUM_LOG_BLOCK_RANGE,
	SETTLEMENT_CHAIN_IDS,
} from '../../constants/settlement-chain.constants';
import {
	evmAddressText,
	httpsUrlText,
	httpUrlText,
	integerChoiceText,
	nonNegativeIntegerText,
	positiveIntegerText,
	privateKeyText,
	text,
} from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const settlementEnvironment = defineEnvironment(
	{
		title: 'Settlement',
		description:
			'The USDC escrow on Base that customers fund and hosts claim from, and the sanctions screening of linked wallets',
	},
	{
		SETTLEMENT_CHAIN_ID: environmentVariable(
			integerChoiceText(SETTLEMENT_CHAIN_IDS),
			{
				description: `EIP-155 chain id of the escrow: ${SETTLEMENT_CHAIN_IDS.join(', ')} (Base, Base Sepolia, local anvil); hosted deployments refuse the local chain.`,
			}
		),
		SETTLEMENT_RPC_URL: environmentVariable(httpUrlText(), {
			description: 'JSON-RPC endpoint of the settlement chain.',
		}),
		SETTLEMENT_ESCROW_ADDRESS: environmentVariable(evmAddressText(), {
			description: 'Address of the deployed SnapflowEscrow contract.',
		}),
		SETTLEMENT_ESCROW_DEPLOYMENT_BLOCK: environmentVariable(
			nonNegativeIntegerText().default(0),
			{
				description:
					'Block the escrow was deployed in; the event indexer starts there instead of scanning the whole chain.',
			}
		),
		SETTLEMENT_LOG_BLOCK_RANGE: environmentVariable(
			positiveIntegerText()
				.pipe(z.number().max(MAXIMUM_LOG_BLOCK_RANGE))
				.prefault(String(DEFAULT_LOG_BLOCK_RANGE)),
			{
				description: `Most blocks one eth_getLogs request may span, and the blocks the escrow indexer records per transaction (at most ${MAXIMUM_LOG_BLOCK_RANGE}). Requests start at this range and shrink automatically when the RPC provider rejects it, then grow back; set it to the provider's documented limit to avoid the first rejection.`,
			}
		),
		SETTLEMENT_INDEXER_RANGES_PER_RUN: environmentVariable(
			positiveIntegerText()
				.pipe(z.number().max(MAXIMUM_INDEXER_RANGES_PER_RUN))
				.prefault(String(DEFAULT_INDEXER_RANGES_PER_RUN)),
			{
				description: `Block ranges of SETTLEMENT_LOG_BLOCK_RANGE the escrow indexer records per run (at most ${MAXIMUM_INDEXER_RANGES_PER_RUN}); raise it to catch up faster after an outage.`,
			}
		),
		SETTLEMENT_USDC_ADDRESS: environmentVariable(evmAddressText(), {
			description: 'Address of the USDC token the escrow settles in.',
		}),
		SETTLEMENT_RELAYER_ADDRESS: environmentVariable(evmAddressText(), {
			description:
				"Address of Snapflow's relayer wallet: machines name it in the HostWithdrawal they sign, so it alone can submit their settlements and collect the relay fee that repays its gas. It is also the escrow's guardian, which pauses deposits when the escrow's USDC balance falls below what it owes.",
		}),
		SETTLEMENT_FEE_RECEIVER_ADDRESS: environmentVariable(evmAddressText(), {
			description:
				"Address every voucher names as its fee receiver; Snapflow's fees accrue to it in the escrow and are swept from there. Platform channels also pay it as their host.",
		}),
		SETTLEMENT_RELAYER_PRIVATE_KEY: environmentVariable(
			privateKeyText().optional(),
			{
				description:
					"Key of the relayer wallet (SETTLEMENT_RELAYER_ADDRESS) that submits host settlements and relayed wallet transactions and settles Snapflow's own channels and fees, paying their gas in ETH; required wherever the worker runs.",
				secret: true,
			}
		),
		SETTLEMENT_ALERTMANAGER_URL: environmentVariable(httpUrlText().optional(), {
			description:
				'Alertmanager that receives settlement alerts as critical alerts and pages through its receivers: deadline claims that failed or would pay nothing, an unreachable chain, a relayer wallet low on gas and relayer transactions stuck pending. Without it (development only) alerts are only logged.',
			requiredIn: PRODUCTION_ONLY,
		}),
		SETTLEMENT_ETH_USD_FEED_ADDRESS: environmentVariable(
			evmAddressText().optional(),
			{
				description:
					'Chainlink ETH/USD price feed (AggregatorV3Interface) on the settlement chain, read to price relay fees in USDC.',
				requiredIn: PRODUCTION_ONLY,
			}
		),
		SETTLEMENT_ETH_USD_PRICE: environmentVariable(
			positiveIntegerText().optional(),
			{
				description:
					'Fixed ETH price in whole US dollars used to price relay fees where the chain has no price feed (the local chain); SETTLEMENT_ETH_USD_FEED_ADDRESS takes precedence.',
				allowedIn: DEVELOPMENT_ONLY,
			}
		),
		SANCTIONS_LIST_URL: environmentVariable(
			httpsUrlText().default(DEFAULT_SANCTIONS_LIST_URL),
			{
				description:
					"HTTPS address of the US Treasury OFAC SDN list (SDN.XML) the worker downloads once a day, refusing redirects to plain HTTP; every EVM address it names is refused as a linked wallet and as a relayed transaction's counterparty, and linked wallets on it are blocked. Until the first download succeeds, wallet linking and relayed transactions are refused.",
			}
		),
		WALLETCONNECT_PROJECT_ID: environmentVariable(text().optional(), {
			description:
				'Public WalletConnect project id from dashboard.walletconnect.com; with it the dashboard can link phone wallets by QR code, without it only browser wallets connect.',
		}),
	}
);
