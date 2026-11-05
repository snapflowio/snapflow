/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EdgeSession } from '../../entities/edge-session.entity';

export function isEdgeUsageIntervalWithinSession(
	session: Pick<EdgeSession, 'proofIssuedAt' | 'expiresAt'> | null,
	intervalStartedAt: Date,
	intervalEndedAt: Date
): boolean {
	return Boolean(
		session &&
			intervalStartedAt >= session.proofIssuedAt &&
			intervalEndedAt <= session.expiresAt
	);
}
