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

import * as pathe from 'pathe';
import {
	SnapflowNotFoundError,
	SnapflowValidationError,
} from '../errors/snapflow-error.js';
import { nodeBuiltin } from '../utils/import.js';

const HOME_DIRECTORY_PREFIX = '~';
const WORKING_DIRECTORY_PREFIX = '~+';

type LocalPathKind = 'file' | 'directory';

export interface LocalPathCheck {
	path: string;
	kind: LocalPathKind;
	missingLabel: string;
	wrongKindLabel: string;
	importErrorPrefix: string;
}

export function resolveLocalPath(check: LocalPathCheck): string {
	const fs = nodeBuiltin('node:fs', check.importErrorPrefix);
	const expandedPath = expandHomeDirectory(check.path, check.importErrorPrefix);
	if (!fs.existsSync(expandedPath)) {
		throw new SnapflowNotFoundError(
			`${check.missingLabel} ${check.path} does not exist`
		);
	}
	const stats = fs.statSync(expandedPath);
	const hasExpectedKind =
		check.kind === 'file' ? stats.isFile() : stats.isDirectory();
	if (!hasExpectedKind) {
		throw new SnapflowValidationError(
			`${check.wrongKindLabel} ${check.path} exists but is not a ${check.kind}`
		);
	}
	return expandedPath;
}

function expandHomeDirectory(path: string, importErrorPrefix: string): string {
	if (path.startsWith(WORKING_DIRECTORY_PREFIX)) {
		return pathe.join(
			process.cwd(),
			path.slice(WORKING_DIRECTORY_PREFIX.length)
		);
	}
	if (path.startsWith(HOME_DIRECTORY_PREFIX)) {
		const os = nodeBuiltin('node:os', importErrorPrefix);
		return pathe.join(os.homedir(), path.slice(HOME_DIRECTORY_PREFIX.length));
	}
	return path;
}
