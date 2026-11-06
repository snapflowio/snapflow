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

// Writes the publishable manifest into the build output, with catalog
// specifiers resolved to their catalog ranges.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveCatalogSpecs } from '../../../scripts/catalog.mjs';

const [distDir, workspaceRoot] = process.argv.slice(2);
if (!distDir || !workspaceRoot) {
	throw new Error('Usage: post-build.mts <dist-dir> <workspace-root>');
}

const manifest = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(
	path.join(distDir, 'package.json'),
	`${JSON.stringify(resolveCatalogSpecs(manifest, workspaceRoot), null, '\t')}\n`
);
