/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { lt, valid } from 'semver';

export function outdatedReleaseReason(
	releaseVersion: string | undefined,
	minimumVersion: string | null
): string | null {
	if (minimumVersion === null) return null;
	const version = releaseVersion ? valid(releaseVersion) : null;
	if (version !== null && !lt(version, minimumVersion)) return null;
	return `Snapflow ${releaseVersion ?? 'with an unknown release'} is older than ${minimumVersion}, the oldest release that may take sandboxes. Update Snapflow on this machine to resume.`;
}
