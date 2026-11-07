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

// Generates the escrow bindings from the Foundry build that contracts:build produces, so forge never runs twice. The
// ABI and the @wagmi/core actions go to separate files: the API, SDK and host code import the ABI without loading
// wagmi, and only the actions entry point needs it. Run with `moon run contracts-ts:generate`.

import { defineConfig } from '@wagmi/cli';
import { actions, foundry } from '@wagmi/cli/plugins';
import { erc20Abi } from 'viem';

const escrowArtifacts = () =>
	foundry({
		project: '../../apps/contracts',
		include: ['SnapflowEscrow.json'],
		forge: { build: false, rebuild: false },
	});

export default defineConfig([
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
