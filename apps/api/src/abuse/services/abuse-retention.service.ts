/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import {
	ABUSE_EVIDENCE_CLEANUP_JOB,
	ABUSE_HOSTNAME_RELEASE_JOB,
} from '../constants/abuse-report.constants';
import { CONNECTION_RECORDS } from '../constants/isp-complaint.constants';
import { AbuseEvidence } from '../entities/abuse-evidence.entity';
import { releaseAbuseHostnames } from '../queries/abuse-hostname.query';
import { expireConnectionCoverage } from '../queries/connection-coverage.query';
import { expireConnectionRecords } from '../queries/connection-record.query';

@Injectable()
export class AbuseRetentionService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly locks: RedisLockProvider
	) {}

	releaseHostnames(): Promise<void> {
		return this.locks.runExclusive(
			ABUSE_HOSTNAME_RELEASE_JOB.lockKey,
			ABUSE_HOSTNAME_RELEASE_JOB.lockTtlSeconds,
			() => releaseAbuseHostnames(this.entityManager.fork())
		);
	}

	expire(): Promise<void> {
		return this.locks.runExclusive(
			ABUSE_EVIDENCE_CLEANUP_JOB.lockKey,
			ABUSE_EVIDENCE_CLEANUP_JOB.lockTtlSeconds,
			async () => {
				await this.expireEvidence();
				await this.expireConnections();
			}
		);
	}

	private async expireEvidence(): Promise<void> {
		const manager = this.entityManager.fork();
		const now = await databaseNow(manager);
		let deleted: number;
		do {
			const expired = await manager.find(
				AbuseEvidence,
				{ retainUntil: { $lt: now } },
				{ fields: ['id'], limit: ABUSE_EVIDENCE_CLEANUP_JOB.batchSize }
			);
			deleted = await manager.nativeDelete(AbuseEvidence, {
				id: { $in: expired.map(({ id }) => id) },
			});
		} while (deleted === ABUSE_EVIDENCE_CLEANUP_JOB.batchSize);
	}

	private async expireConnections(): Promise<void> {
		const manager = this.entityManager.fork();
		let deleted: number;
		do {
			deleted = await expireConnectionRecords(
				manager,
				CONNECTION_RECORDS.retentionSeconds,
				CONNECTION_RECORDS.cleanupBatchSize
			);
		} while (deleted === CONNECTION_RECORDS.cleanupBatchSize);
		await expireConnectionCoverage(
			manager,
			CONNECTION_RECORDS.retentionSeconds
		);
	}
}
