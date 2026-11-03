/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SOURCE_REVISION_PATTERN = /^[0-9a-f]{40}$/;
const UNRELEASED_VERSION_PATTERN = /^0\.0\.0(?:-|$)/;
const TAG_REF_TYPE = 'tag';
const GIT_ARGUMENTS = ['rev-parse', 'HEAD'] as const;
const FAILURE_EXIT_CODE = 1;

type BuildEnvironment = Readonly<
	Partial<
		Record<
			| 'SNAPFLOW_RELEASE_VERSION'
			| 'SNAPFLOW_SOURCE_REVISION'
			| 'GITHUB_SHA'
			| 'GITHUB_REF_TYPE'
			| 'GITHUB_REF_NAME',
			string
		>
	>
>;

export interface BuildProvenance {
	readonly releaseVersion: string | null;
	readonly sourceRevision: string | null;
}

function checkoutRevision(directory: string): string | null {
	try {
		return execFileSync('git', GIT_ARGUMENTS, {
			cwd: directory,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return null;
	}
}

function resolveSourceRevision(
	environment: BuildEnvironment = process.env,
	directory: string = process.cwd()
): string | null {
	const revision =
		environment.SNAPFLOW_SOURCE_REVISION ||
		environment.GITHUB_SHA ||
		checkoutRevision(directory);
	if (revision !== null && !SOURCE_REVISION_PATTERN.test(revision)) {
		throw new Error(`${revision} is not a full lowercase Git commit SHA`);
	}
	return revision;
}

function resolveReleaseVersion(
	packageVersion: string,
	environment: BuildEnvironment = process.env
): string | null {
	if (environment.SNAPFLOW_RELEASE_VERSION) {
		return environment.SNAPFLOW_RELEASE_VERSION;
	}
	if (
		environment.GITHUB_REF_TYPE === TAG_REF_TYPE &&
		environment.GITHUB_REF_NAME
	) {
		return environment.GITHUB_REF_NAME;
	}
	return UNRELEASED_VERSION_PATTERN.test(packageVersion)
		? null
		: packageVersion;
}

export function resolveBuildProvenance(
	packageVersion: string,
	environment: BuildEnvironment = process.env,
	directory: string = process.cwd()
): BuildProvenance {
	return {
		releaseVersion: resolveReleaseVersion(packageVersion, environment),
		sourceRevision: resolveSourceRevision(environment, directory),
	};
}

export function requireSourceRevision(
	environment: BuildEnvironment = process.env
): string {
	const revision = resolveSourceRevision(environment);
	if (revision === null) {
		throw new Error(
			'The source revision needs CI (GITHUB_SHA) or a Git checkout'
		);
	}
	return revision;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	try {
		console.log(`SNAPFLOW_SOURCE_REVISION=${requireSourceRevision()}`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = FAILURE_EXIT_CODE;
	}
}
