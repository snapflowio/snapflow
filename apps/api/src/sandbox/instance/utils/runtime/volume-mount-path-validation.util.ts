/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxVolume } from '../../dto/sandbox.dto';

const ROOT_MOUNT_PATHS: ReadonlySet<string> = new Set(['/', '//']);
const RELATIVE_SEGMENTS = ['/../', '/./'] as const;
const RELATIVE_SUFFIXES = ['/..', '/.'] as const;
const CONSECUTIVE_SLASHES = /\/\/+/;
const SYSTEM_DIRECTORIES = [
	'/proc',
	'/sys',
	'/dev',
	'/boot',
	'/etc',
	'/bin',
	'/sbin',
	'/lib',
	'/lib64',
] as const;

function mountPathError(value: unknown): string | null {
	if (typeof value !== 'string') {
		return `Invalid mount path ${value} (must be a string)`;
	}
	if (!value.startsWith('/')) {
		return `Invalid mount path ${value} (must be absolute)`;
	}
	if (ROOT_MOUNT_PATHS.has(value)) {
		return `Invalid mount path ${value} (cannot mount to the root directory)`;
	}
	if (
		RELATIVE_SEGMENTS.some((segment) => value.includes(segment)) ||
		RELATIVE_SUFFIXES.some((suffix) => value.endsWith(suffix))
	) {
		return `Invalid mount path ${value} (cannot contain relative path components)`;
	}
	if (CONSECUTIVE_SLASHES.test(value.slice(1))) {
		return `Invalid mount path ${value} (cannot contain consecutive slashes)`;
	}
	if (
		SYSTEM_DIRECTORIES.some(
			(directory) => value === directory || value.startsWith(`${directory}/`)
		)
	) {
		return `Invalid mount path ${value} (cannot mount to system directory)`;
	}
	return null;
}

function subpathError(subpath: unknown): string | null {
	if (!subpath) {
		return null;
	}
	if (typeof subpath !== 'string') {
		return `Invalid subpath ${subpath} (must be a string)`;
	}
	if (subpath.startsWith('/')) {
		return `Invalid subpath "${subpath}" (S3 key prefixes cannot start with /)`;
	}
	if (subpath.includes('..')) {
		return `Invalid subpath "${subpath}" (cannot contain .. for security)`;
	}
	if (subpath.includes('//')) {
		return `Invalid subpath "${subpath}" (cannot contain consecutive slashes)`;
	}
	return null;
}

function assertNoErrors(errors: readonly (string | null)[]): void {
	const messages = errors.filter((error) => error !== null);
	if (messages.length > 0) {
		throw new Error(messages.join(', '));
	}
}

export function validateMountPaths(volumes: SandboxVolume[]): void {
	assertNoErrors(volumes.map((volume) => mountPathError(volume.mountPath)));
}

export function validateSubpaths(volumes: SandboxVolume[]): void {
	assertNoErrors(volumes.map((volume) => subpathError(volume.subpath)));
}
