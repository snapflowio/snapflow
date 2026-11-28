/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { existsSync, readdirSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { type Configuration, rspack } from '@rspack/core';
import { resolveBuildProvenance } from './build-provenance.mts';
import apiPackage from './package.json' with { type: 'json' };

const appDirectory = import.meta.dirname;
const workspaceDirectory = join(appDirectory, '../..');
const sourceDirectory = join(appDirectory, 'src');
const migrationDirectory = join(sourceDirectory, 'migrations');
const modulesDirectoryName = 'node_modules';
const workspaceSourceCondition = '@snapflow/source';
const buildProvenanceGlobal = 'SNAPFLOW_BUILD';
const migrationFilePattern = /^\d+-migration\.ts$/;
const sourceFilePattern = /\.[cm]?[jt]sx?$/;
const modulesPathPattern = /[\\/]node_modules[\\/]/;
const scopedPackagePrefix = '@';
const modulePathSeparator = '/';
const outputDirectories = {
	production: 'api',
	development: 'api-development',
} as const;
const bundledWorkspaceLibraries = [
	'contracts',
	'machine-proto',
	'organization-access',
	'toolbox-api-client',
] as const;
const bundledWorkspacePackages = new RegExp(
	`^@snapflow/(${bundledWorkspaceLibraries.join('|')})(/|$)`
);

type BuildMode = keyof typeof outputDirectories;

function buildMode(): BuildMode {
	return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

function visibleDirectories(directory: string): string[] {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
		.map((entry) => entry.name);
}

function installedPackages(modulesDirectory: string): string[] {
	return visibleDirectories(modulesDirectory).flatMap((name) =>
		name.startsWith(scopedPackagePrefix)
			? visibleDirectories(join(modulesDirectory, name)).map(
					(scopedName) => `${name}${modulePathSeparator}${scopedName}`
				)
			: [name]
	);
}

function packagesInstalledFor(owners: string[]): Set<string> {
	return new Set(
		owners.flatMap((owner) =>
			installedPackages(join(owner, modulesDirectoryName))
		)
	);
}

function packageName(request: string): string {
	const segments = request.split(modulePathSeparator);
	const length = request.startsWith(scopedPackagePrefix) ? 2 : 1;
	return segments.slice(0, length).join(modulePathSeparator);
}

function externalPackageFilter(): (request: string) => boolean {
	const workspacePackages = packagesInstalledFor([workspaceDirectory]);
	const bundledPackages = packagesInstalledFor([
		appDirectory,
		...bundledWorkspaceLibraries.map((library) =>
			join(workspaceDirectory, 'libs', library)
		),
	]);
	return (request) => {
		if (bundledWorkspacePackages.test(request)) return false;
		const name = packageName(request);
		return workspacePackages.has(name) && !bundledPackages.has(name);
	};
}

function filesBelow(directory: string, matches: RegExp): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) return filesBelow(entryPath, matches);
		return entry.isFile() && matches.test(entry.name) ? [entryPath] : [];
	});
}

function migrationEntries(): Record<string, string> {
	if (!existsSync(migrationDirectory)) return {};
	return Object.fromEntries(
		filesBelow(migrationDirectory, migrationFilePattern)
			.sort()
			.map((file) => {
				const entryPath = relative(migrationDirectory, file)
					.slice(0, -extname(file).length)
					.split(sep)
					.join(modulePathSeparator);
				return [`migrations/${entryPath}`, file];
			})
	);
}

function applicationEntries(): Record<string, string> {
	const entries = {
		main: join(sourceDirectory, 'main.ts'),
		cli: join(sourceDirectory, 'cli.ts'),
		'generate-openapi': join(sourceDirectory, 'generate-openapi.ts'),
		'migrations/data-source': join(migrationDirectory, 'data-source.ts'),
		...migrationEntries(),
	};
	const missing = Object.values(entries).filter((file) => !existsSync(file));
	if (missing.length > 0) {
		throw new Error(`API entry points are missing: ${missing.join(', ')}`);
	}
	return entries;
}

export default function createConfiguration(
	defaults: Configuration
): Configuration {
	const mode = buildMode();
	const production = mode === 'production';
	const isExternalPackage = externalPackageFilter();
	return {
		...defaults,
		mode,
		target: 'node',
		context: workspaceDirectory,
		entry: applicationEntries(),
		devtool: 'source-map',
		output: {
			path: join(workspaceDirectory, 'dist/apps', outputDirectories[mode]),
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
				[buildProvenanceGlobal]: JSON.stringify(
					resolveBuildProvenance(apiPackage.version)
				),
			}),
		],
		externalsPresets: { node: true },
		externalsType: 'module',
		externals: [
			async ({ request }) =>
				request !== undefined && isExternalPackage(request)
					? request
					: undefined,
		],
		module: {
			rules: [
				{
					test: sourceFilePattern,
					exclude: modulesPathPattern,
					type: 'javascript/auto',
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
