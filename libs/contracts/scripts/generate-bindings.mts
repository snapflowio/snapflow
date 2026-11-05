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

// Writes the escrow ABI from the Foundry build as a typed `as const` module, so viem infers every function, argument
// and event type from it. Run with `moon run contracts-ts:generate` after changing the contract.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ARTIFACT_PATH =
	'../../../apps/contracts/out/SnapflowEscrow.sol/SnapflowEscrow.json';
const OUTPUT_PATH = '../src/generated/snapflow-escrow.abi.ts';
const LICENSE_HEADER_END = ' */';

const resolvePath = (relativePath: string) =>
	fileURLToPath(new URL(relativePath, import.meta.url));

const ownSource = await readFile(fileURLToPath(import.meta.url), 'utf8');
const licenseHeader = ownSource.slice(
	0,
	ownSource.indexOf(LICENSE_HEADER_END) + LICENSE_HEADER_END.length
);
const artifact: { abi: unknown } = JSON.parse(
	await readFile(resolvePath(ARTIFACT_PATH), 'utf8')
);

await writeFile(
	resolvePath(OUTPUT_PATH),
	`${licenseHeader}

// Generated from apps/contracts by libs/contracts/scripts/generate-bindings.mts. Do not edit.

export const snapflowEscrowAbi = ${JSON.stringify(artifact.abi)} as const;
`
);
