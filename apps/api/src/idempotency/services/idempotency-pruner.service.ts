/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, RequestContext, sql } from '@mikro-orm/core';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { RETENTION_POLICY } from '../../common/constants/retention-policy.constants';
import { ApiIdempotencyRecord } from '../entities/api-idempotency-record.entity';

@Injectable()
export class IdempotencyPrunerService {
	private readonly logger = new Logger(IdempotencyPrunerService.name);

	constructor(
		private readonly orm: MikroORM,
		private readonly entityManager: EntityManager
	) {}

	async prune(): Promise<void> {
		const deleted = await RequestContext.create(this.orm.em, () =>
			this.pruneInContext()
		);
		if (deleted > 0) this.logger.log(`Pruned ${deleted} idempotency records`);
	}

	private async pruneInContext(): Promise<number> {
		return this.entityManager.transactional(async (manager) => {
			const records = await manager.find(
				ApiIdempotencyRecord,
				{ expiresAt: { $lte: sql.now() } },
				{
					limit: RETENTION_POLICY.idempotencyPruneBatchSize,
					lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE,
					orderBy: { expiresAt: 'ASC' },
				}
			);

			if (records.length > 0) {
				manager.remove(records);
			}

			return records.length;
		});
	}
}
