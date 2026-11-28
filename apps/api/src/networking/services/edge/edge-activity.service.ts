/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { SandboxActivityService } from '../../../sandbox/services/sandbox/sandbox-activity.service';
import { EDGE_CONTROL_LIMITS } from '../../constants/edge.constants';
import {
	type AccessSessionObservation,
	ProtectedAccessSessionService,
} from '../protected-access/protected-access-session.service';

@Injectable()
export class EdgeActivityService {
	private readonly logger = new Logger(EdgeActivityService.name);

	constructor(
		private readonly sessions: ProtectedAccessSessionService,
		private readonly sandboxActivity: SandboxActivityService
	) {}

	async observeAccessSessions(
		edgeId: string,
		sessionIds: string[],
		observedAt: Date
	): Promise<Omit<AccessSessionObservation, 'activeSandboxIds'>> {
		try {
			const { activeSandboxIds, ...decisions } = await this.sessions.observe(
				edgeId,
				sessionIds,
				observedAt
			);
			await this.recordSandboxActivity(activeSandboxIds, observedAt);
			return decisions;
		} catch (error) {
			this.logger.warn('Could not reconcile Edge access sessions', error);
			return { sessions: [], revokedSessionIds: [] };
		}
	}

	async recordSandboxActivity(
		sandboxIds: string[],
		observedAt: Date
	): Promise<void> {
		const uniqueSandboxIds = [...new Set(sandboxIds)];
		for (
			let offset = 0;
			offset < uniqueSandboxIds.length;
			offset += EDGE_CONTROL_LIMITS.activityUpdateConcurrency
		) {
			const results = await settleSequentially(
				uniqueSandboxIds.slice(
					offset,
					offset + EDGE_CONTROL_LIMITS.activityUpdateConcurrency
				),
				(sandboxId) =>
					this.sandboxActivity.updateLastActivityAt(sandboxId, observedAt)
			);
			for (const result of results) {
				if (result.status === 'rejected') {
					this.logger.warn(
						'Could not record sandbox activity from Edge traffic',
						result.reason
					);
				}
			}
		}
	}
}
