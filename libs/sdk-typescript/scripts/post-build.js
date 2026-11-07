#!/usr/bin/env node

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

import fs from 'node:fs';
import path from 'node:path';
import { resolveCatalogSpecs } from '../../../scripts/catalog.mjs';

const [distDir, workspaceRoot, sourceDir] = process.argv.slice(2);
if (!distDir || !workspaceRoot || !sourceDir) {
	throw new Error(
		'Usage: post-build.js <dist-dir> <workspace-root> <source-dir>'
	);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// Workspace links are replaced with the versions of the built client packages
// and catalog specifiers with their catalog ranges.
const pkg = resolveCatalogSpecs(
	readJson(path.join(sourceDir, 'package.json')),
	workspaceRoot
);
for (const name of ['api-client', 'contracts', 'toolbox-api-client']) {
	const distPkg = readJson(
		path.join(workspaceRoot, 'dist', 'libs', name, 'package.json')
	);
	pkg.dependencies[`@snapflow/${name}`] = distPkg.version;
}

fs.writeFileSync(
	path.join(distDir, 'package.json'),
	`${JSON.stringify(pkg, null, 2)}\n`
);
for (const file of ['README.md', 'LICENSE']) {
	const src = path.join(sourceDir, file);
	if (fs.existsSync(src)) fs.copyFileSync(src, path.join(distDir, file));
}
