/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { rspack } from '@rspack/core';
import nodeExternals from 'webpack-node-externals';
import { resolveBuildProvenance } from '../../scripts/build-provenance.mts';
import apiPackage from './package.json' with { type: 'json' };

const appDirectory = import.meta.dirname;
const workspaceDirectory = join(appDirectory, '../..');
const sourceDirectory = join(appDirectory, 'src');
const migrationDirectory = join(sourceDirectory, 'migrations');
const bundledWorkspacePackages =
	/^@snapflow\/(contracts|machine-proto|organization-access|toolbox-api-client)(\/|$)/;
const workspaceSourceCondition = '@snapflow/source';
const testFilePattern = /\.test\.ts$/;
const migrationFilePattern = /^\d+-migration\.ts$/;
const BuildTarget = {
	PRODUCTION: 'production',
	TEST: 'test',
	DEVELOPMENT: 'development',
};
const BUILD_PROVENANCE_GLOBAL = 'SNAPFLOW_BUILD';
const OUTPUT_NAMES = {
	[BuildTarget.PRODUCTION]: 'api',
	[BuildTarget.TEST]: 'api-tests',
	[BuildTarget.DEVELOPMENT]: 'api-development',
};

function findFiles(directory, matches) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) return findFiles(entryPath, matches);
		return entry.isFile() && matches(entry.name) ? [entryPath] : [];
	});
}

function entriesBelow(directory, prefix, matches) {
	if (!existsSync(directory)) return {};
	return Object.fromEntries(
		findFiles(directory, matches)
			.sort()
			.map((entryPath) => {
				const name = relative(directory, entryPath).split(sep).join('/');
				return [`${prefix}${name.slice(0, -'.ts'.length)}`, entryPath];
			})
	);
}

function applicationEntries() {
	return {
		main: join(sourceDirectory, 'main.ts'),
		cli: join(sourceDirectory, 'cli.ts'),
		'generate-openapi': join(sourceDirectory, 'generate-openapi.ts'),
		'migrations/data-source': join(migrationDirectory, 'data-source.ts'),
		'migrations/pre-deploy/data-source': join(
			migrationDirectory,
			'pre-deploy/data-source.ts'
		),
		'migrations/post-deploy/data-source': join(
			migrationDirectory,
			'post-deploy/data-source.ts'
		),
		...entriesBelow(migrationDirectory, 'migrations/', (name) =>
			migrationFilePattern.test(name)
		),
	};
}

function buildTarget() {
	const target = process.env.NODE_ENV;
	return target === BuildTarget.PRODUCTION || target === BuildTarget.TEST
		? target
		: BuildTarget.DEVELOPMENT;
}

export default function createConfiguration(defaults) {
	const target = buildTarget();
	const production = target === BuildTarget.PRODUCTION;
	const [swcRule] = defaults.module.rules;
	const provenance = resolveBuildProvenance(apiPackage.version);
	return {
		...defaults,
		mode: production ? 'production' : 'development',
		context: workspaceDirectory,
		entry:
			target === BuildTarget.TEST
				? entriesBelow(sourceDirectory, '', (name) =>
						testFilePattern.test(name)
					)
				: applicationEntries(),
		devtool: 'source-map',
		experiments: { outputModule: true },
		output: {
			path: join(workspaceDirectory, 'dist/apps', OUTPUT_NAMES[target]),
			clean: true,
			filename: '[name].mjs',
			asyncChunks: production,
			chunkFilename: '[name].[contenthash].mjs',
			chunkFormat: 'module',
			chunkLoading: 'import',
			module: true,
			library: { type: 'module' },
		},
		plugins: [
			...(defaults.plugins ?? []),
			new rspack.DefinePlugin({
				[BUILD_PROVENANCE_GLOBAL]: JSON.stringify(provenance),
			}),
		],
		externalsPresets: { node: true },
		externalsType: 'module',
		externals: [
			nodeExternals({
				importType: 'module',
				modulesDir: join(workspaceDirectory, 'node_modules'),
				allowlist: [bundledWorkspacePackages],
			}),
		],
		module: {
			rules: [
				{
					...swcRule,
					test: /\.[cm]?[jt]sx?$/,
					type: 'javascript/auto',
					use: [
						{
							loader: 'builtin:swc-loader',
							options: {
								isModule: 'unknown',
								sourceMaps: true,
								jsc: {
									target: 'es2023',
									parser: {
										syntax: 'typescript',
										tsx: true,
										decorators: true,
										dynamicImport: true,
									},
									transform: {
										decoratorMetadata: true,
										legacyDecorator: true,
										react: { runtime: 'automatic' },
									},
								},
							},
						},
					],
				},
			],
		},
		resolve: {
			alias: {
				'@snapflow/machine-proto': join(
					workspaceDirectory,
					'libs/machine-proto/index.ts'
				),
			},
			conditionNames: [
				workspaceSourceCondition,
				'import',
				'module',
				'node',
				'default',
			],
			extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'],
			extensionAlias: {
				'.js': ['.ts', '.js'],
				'.jsx': ['.tsx', '.jsx'],
				'.mjs': ['.mts', '.mjs'],
			},
			fullySpecified: false,
		},
		optimization: {
			...defaults.optimization,
			avoidEntryIife: true,
			concatenateModules: false,
			minimize: false,
		},
		cache: false,
		infrastructureLogging: { level: 'warn' },
		stats: 'errors-warnings',
	};
}
