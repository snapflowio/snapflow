/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export function registryMismatch(
	discovered: ReadonlySet<string>,
	registered: ReadonlySet<string>,
	entryCount: number
): string | null {
	const missing = [...discovered].filter((key) => !registered.has(key)).sort();
	const stale = [...registered].filter((key) => !discovered.has(key)).sort();
	const duplicateCount = entryCount - registered.size;
	const problems = [
		...(missing.length > 0 ? [`Missing: ${missing.join(', ')}`] : []),
		...(stale.length > 0 ? [`Stale: ${stale.join(', ')}`] : []),
		...(duplicateCount > 0 ? [`Duplicate entries: ${duplicateCount}`] : []),
	];
	if (problems.length === 0) return null;
	return [
		'Mutation policy registry does not match the HTTP controller surface.',
		...problems,
	].join(' ');
}
