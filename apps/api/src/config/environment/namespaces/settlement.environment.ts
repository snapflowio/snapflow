/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PRODUCTION_ONLY } from '../../constants/deployment-environment.constants';
import {
	DEFAULT_SANCTIONS_API_URL,
	SETTLEMENT_CHAIN_IDS,
} from '../../constants/settlement-chain.constants';
import {
	evmAddressText,
	httpUrlText,
	integerChoiceText,
	nonNegativeIntegerText,
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
		SETTLEMENT_USDC_ADDRESS: environmentVariable(evmAddressText(), {
			description: 'Address of the USDC token the escrow settles in.',
		}),
		SETTLEMENT_SIGNER_PRIVATE_KEY: environmentVariable(privateKeyText(), {
			description:
				"Key of Snapflow's delegated voucher signer; customers authorize its address as an escrow session key so Snapflow can sign vouchers for them within their caps. It needs no funds.",
			secret: true,
		}),
		SETTLEMENT_RELAYER_PRIVATE_KEY: environmentVariable(
			privateKeyText().optional(),
			{
				description:
					'Key of the wallet that sends voucher claims to the escrow and pays their gas in ETH; required wherever the worker runs.',
				secret: true,
			}
		),
		SANCTIONS_API_KEY: environmentVariable(text().optional(), {
			description:
				'Chainalysis sanctions screening API key; without it (development only) linked wallets are recorded as unchecked.',
			secret: true,
			requiredIn: PRODUCTION_ONLY,
		}),
		SANCTIONS_API_URL: environmentVariable(
			httpUrlText().default(DEFAULT_SANCTIONS_API_URL),
			{
				description:
					'Chainalysis sanctions screening endpoint; the address is appended as the last path segment.',
			}
		),
	}
);
