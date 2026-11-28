/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export function isEdgeSessionGenerationAccepted(
	edgeGeneration: number,
	sessionGeneration: number,
	replacementGraceExpiresAt: Date | null,
	observedAt: Date
): boolean {
	if (edgeGeneration === sessionGeneration) return true;
	return (
		edgeGeneration === sessionGeneration + 1 &&
		replacementGraceExpiresAt !== null &&
		replacementGraceExpiresAt > observedAt
	);
}
