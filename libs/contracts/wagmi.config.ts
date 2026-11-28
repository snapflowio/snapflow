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
	getCompatibilityFallbackHandlerDeployment,
	getMultiSendCallOnlyDeployment,
	getProxyFactoryDeployment,
	getSafeL2SingletonDeployment,
	type SingletonDeployment,
} from '@safe-global/safe-deployments';
import {
	type Deployment,
	getDaimoP256VerifierDeployment,
	getSafeWebAuthnSignerFactoryDeployment,
} from '@safe-global/safe-modules-deployments';
import { defineConfig } from '@wagmi/cli';
import { actions, foundry } from '@wagmi/cli/plugins';
import { type Abi, type Address, erc20Abi, getAddress } from 'viem';

const SAFE_VERSION = '1.4.1';
const PASSKEY_MODULE_VERSION = '0.2.1';
const BASE_CHAIN_ID = '8453';

const escrowArtifacts = () =>
	foundry({
		project: '../../apps/contracts',
		include: ['SnapflowEscrow.json'],
		forge: { build: false, rebuild: false },
	});

function safeContract(
	name: string,
	deployment: SingletonDeployment | Deployment | undefined
): { name: string; abi: Abi; address: Address } {
	const address = deployment?.networkAddresses[BASE_CHAIN_ID];
	if (!deployment || !address) {
		throw new Error(`Safe's registry has no ${name} deployment on Base`);
	}
	return { name, abi: deployment.abi, address: getAddress(address) };
}

const safeFilter = { version: SAFE_VERSION, released: true };
const passkeyFilter = { version: PASSKEY_MODULE_VERSION, released: true };

export default defineConfig([
	{
		out: 'src/generated/safe.abi.ts',
		contracts: [
			safeContract('SafeL2', getSafeL2SingletonDeployment(safeFilter)),
			safeContract('SafeProxyFactory', getProxyFactoryDeployment(safeFilter)),
			safeContract(
				'CompatibilityFallbackHandler',
				getCompatibilityFallbackHandlerDeployment(safeFilter)
			),
			safeContract(
				'MultiSendCallOnly',
				getMultiSendCallOnlyDeployment(safeFilter)
			),
			safeContract(
				'SafeWebAuthnSignerFactory',
				getSafeWebAuthnSignerFactoryDeployment(passkeyFilter)
			),
			safeContract(
				'DaimoP256Verifier',
				getDaimoP256VerifierDeployment(passkeyFilter)
			),
		],
	},
	{
		out: 'src/generated/snapflow-escrow.abi.ts',
		plugins: [escrowArtifacts()],
	},
	{
		out: 'src/generated/snapflow-escrow.actions.ts',
		contracts: [{ name: 'Usdc', abi: erc20Abi }],
		plugins: [
			escrowArtifacts(),
			actions({ overridePackageName: '@wagmi/core' }),
		],
	},
]);
