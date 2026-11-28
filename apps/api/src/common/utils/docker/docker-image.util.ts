/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export function checkDockerfileHasRegistryPrefix(
	dockerfileContent: string
): boolean {
	const lines = dockerfileContent.split('\n');

	const fromRegex =
		/^\s*FROM\s+(?:--[a-z-]+=[^\s]+\s+)*([^\s]+)(?:\s+AS\s+[^\s]+)?/i;

	for (const line of lines) {
		const lineWithoutComment = line.split('#')[0];
		const trimmedLine = lineWithoutComment.trim();

		if (!trimmedLine) {
			continue;
		}

		const match = fromRegex.exec(trimmedLine);
		if (match?.[1]) {
			const imageName = match[1].trim();

			if (imageName.includes('/')) {
				return true;
			}
		}
	}

	return false;
}
