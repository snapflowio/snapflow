// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

// Resolves pnpm `catalog:` specifiers in a package manifest to the version
// ranges of the default catalog in pnpm-workspace.yaml, so manifests copied
// into dist/ can be published with npm. Named catalogs are not used in this
// workspace and are refused rather than guessed.

import fs from 'node:fs';
import path from 'node:path';

const CATALOG_PROTOCOL = 'catalog:';
const CATALOG_HEADER = 'catalog:';
const DEPENDENCY_FIELDS = [
	'dependencies',
	'peerDependencies',
	'optionalDependencies',
	'devDependencies',
];
// A flat two-space indented `name: range` entry; names and ranges may be quoted.
const CATALOG_ENTRY =
	/^ {2}(?:'([^']+)'|"([^"]+)"|([^\s:'"]+)):\s*['"]?([^'"#\s]+)['"]?\s*$/;
const TOP_LEVEL_LINE = /^\S/;

function readDefaultCatalog(workspaceRoot) {
	const lines = fs
		.readFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), 'utf8')
		.split('\n');
	const start = lines.indexOf(CATALOG_HEADER);
	if (start === -1) {
		throw new Error('pnpm-workspace.yaml has no default catalog');
	}
	const catalog = new Map();
	for (const line of lines.slice(start + 1)) {
		if (TOP_LEVEL_LINE.test(line)) break;
		const entry = CATALOG_ENTRY.exec(line);
		if (entry) {
			const [, singleQuoted, doubleQuoted, bare, range] = entry;
			catalog.set(singleQuoted ?? doubleQuoted ?? bare, range);
		}
	}
	return catalog;
}

/** Returns a copy of `manifest` with every `catalog:` specifier replaced by its catalog range. */
export function resolveCatalogSpecs(manifest, workspaceRoot) {
	const catalog = readDefaultCatalog(workspaceRoot);
	const resolved = { ...manifest };
	for (const field of DEPENDENCY_FIELDS) {
		if (!manifest[field]) continue;
		resolved[field] = Object.fromEntries(
			Object.entries(manifest[field]).map(([name, spec]) => {
				if (!spec.startsWith(CATALOG_PROTOCOL)) return [name, spec];
				const range = catalog.get(name);
				if (spec !== CATALOG_PROTOCOL || range === undefined) {
					throw new Error(`Cannot resolve ${name}@${spec} from the catalog`);
				}
				return [name, range];
			})
		);
	}
	return resolved;
}
