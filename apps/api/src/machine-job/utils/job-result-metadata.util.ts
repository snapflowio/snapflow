/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Job } from '../entities/job.entity';

export interface SnapshotJobResultMetadata {
	sizeGB: number;
	entrypoint: string[];
	cmd: string[];
	hash: string;
}

export interface SnapshotDigestJobResultMetadata {
	hash: string;
	sizeGB: number;
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === 'string')
	);
}

function parseOptionalStringArray(value: unknown): string[] | null {
	if (value === undefined) return [];
	return isStringArray(value) ? value : null;
}

export function getSnapshotJobResultMetadata(
	job: Job
): SnapshotJobResultMetadata | null {
	const metadata = job.getResultMetadata();
	const entrypoint = parseOptionalStringArray(metadata?.entrypoint);
	const cmd = parseOptionalStringArray(metadata?.cmd);
	if (
		typeof metadata?.sizeGB !== 'number' ||
		!Number.isFinite(metadata.sizeGB) ||
		entrypoint === null ||
		cmd === null ||
		typeof metadata.hash !== 'string'
	) {
		return null;
	}
	return {
		sizeGB: metadata.sizeGB,
		entrypoint,
		cmd,
		hash: metadata.hash,
	};
}

export function getSnapshotDigestJobResultMetadata(
	job: Job
): SnapshotDigestJobResultMetadata | null {
	const metadata = job.getResultMetadata();
	if (
		typeof metadata?.hash !== 'string' ||
		typeof metadata.sizeGB !== 'number' ||
		!Number.isFinite(metadata.sizeGB)
	) {
		return null;
	}

	return { hash: metadata.hash, sizeGB: metadata.sizeGB };
}
