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

import { parse as parseToml } from '@iarna/toml';
import { quote } from 'shell-quote';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import type { PipInstallOptions, PyprojectOptions } from '../image.types.js';
import { nodeBuiltin } from '../utils/import.js';
import { isRecord } from '../utils/record.js';
import { isStringList } from './dockerfile.js';

const SUPPORTED_PYTHON_SERIES = [
	'3.9',
	'3.10',
	'3.11',
	'3.12',
	'3.13',
] as const;
export type SupportedPythonSeries = (typeof SUPPORTED_PYTHON_SERIES)[number];
const LATEST_PYTHON_MICRO_VERSIONS = [
	'3.9.22',
	'3.10.17',
	'3.11.12',
	'3.12.10',
	'3.13.3',
];
const PYPROJECT_FORMAT_GUIDE_URL =
	'https://packaging.python.org/en/latest/guides/writing-pyproject-toml';

export function resolvePythonVersion(
	pythonVersion?: SupportedPythonSeries
): string {
	const series =
		pythonVersion ??
		SUPPORTED_PYTHON_SERIES[SUPPORTED_PYTHON_SERIES.length - 1];

	if (!SUPPORTED_PYTHON_SERIES.includes(series)) {
		throw new SnapflowValidationError(
			`Unsupported Python version: ${series}. ` +
				`Snapflow supports the following series: ${SUPPORTED_PYTHON_SERIES.join(', ')}`
		);
	}

	const seriesMap = Object.fromEntries(
		LATEST_PYTHON_MICRO_VERSIONS.map((v) => {
			const [major, minor, micro] = v.split('.');
			return [`${major}.${minor}`, micro];
		})
	);

	const micro = seriesMap[series];
	return `${series}.${micro}`;
}

export function formatPipInstallArgs(options?: PipInstallOptions): string {
	if (!options) return '';

	let extraArgs = '';

	for (const findLink of options.findLinks ?? []) {
		extraArgs += ` --find-links ${quote([findLink])}`;
	}

	if (options.indexUrl) {
		extraArgs += ` --index-url ${quote([options.indexUrl])}`;
	}

	for (const extraIndexUrl of options.extraIndexUrls ?? []) {
		extraArgs += ` --extra-index-url ${quote([extraIndexUrl])}`;
	}

	if (options.pre) {
		extraArgs += ' --pre';
	}

	if (options.extraOptions) {
		extraArgs += ` ${options.extraOptions.trim()}`;
	}

	return extraArgs;
}

export function flattenStringArgs(
	functionName: string,
	argName: string,
	args: unknown
): string[] {
	if (typeof args === 'string') {
		return [args];
	}
	if (Array.isArray(args)) {
		return args.flatMap((item) =>
			flattenStringArgs(functionName, argName, item)
		);
	}
	throw new SnapflowValidationError(
		`${functionName}: ${argName} must only contain strings`
	);
}

function readPyproject(
	expandedPath: string,
	displayPath: string,
	importErrorPrefix: string
): ReturnType<typeof parseToml> {
	const fs = nodeBuiltin('node:fs', importErrorPrefix);
	try {
		return parseToml(fs.readFileSync(expandedPath, 'utf-8'));
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new SnapflowValidationError(
			`Invalid pyproject.toml file ${displayPath}: ${errorMessage}`
		);
	}
}

export function readPyprojectDependencies(
	expandedPath: string,
	displayPath: string,
	options: PyprojectOptions | undefined,
	importErrorPrefix: string
): string[] {
	const project = readPyproject(
		expandedPath,
		displayPath,
		importErrorPrefix
	).project;
	if (!isRecord(project) || !isStringList(project.dependencies)) {
		throw new SnapflowValidationError(
			'No [project.dependencies] section in pyproject.toml file. ' +
				`See ${PYPROJECT_FORMAT_GUIDE_URL} ` +
				'for further file format guidelines.'
		);
	}

	const dependencies = [...project.dependencies];
	const optionalGroups = project['optional-dependencies'];
	if (!options?.optionalDependencies || optionalGroups === undefined) {
		return dependencies;
	}
	if (!isRecord(optionalGroups)) {
		throw new SnapflowValidationError(
			'optional-dependencies must be a mapping in pyproject.toml'
		);
	}

	for (const group of options.optionalDependencies) {
		const groupDependencies = optionalGroups[group];
		if (isStringList(groupDependencies)) {
			dependencies.push(...groupDependencies);
		}
	}
	return dependencies;
}
