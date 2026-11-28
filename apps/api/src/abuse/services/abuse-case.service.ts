/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder, RequestContext } from '@mikro-orm/core';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import { errorMessage } from '../../common/utils/error/error.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import {
	ABUSE_LADDER,
	ABUSE_THROTTLE_RELEASE_JOB,
	AbuseCaseStatus,
} from '../constants/abuse.constants';
import {
	AbuseCaseDto,
	type AbuseCaseListQueryDto,
} from '../dto/abuse-case.dto';
import { AbuseCase } from '../entities/abuse-case.entity';
import { AbuseCaseActionService } from './abuse-case-action.service';
import { AbuseLadderService } from './abuse-ladder.service';

interface IdentifierRow {
	id: string;
}

const ORPHANED_CONTROLS_SQL = `SELECT sandbox.id
	FROM sandbox
	WHERE (sandbox."networkThrottleConnectionsPerSecond" IS NOT NULL OR sandbox."abuseEgressBlock" OR sandbox."abuseHold")
	  AND sandbox.state <> ?
	  AND NOT EXISTS (
	    SELECT 1 FROM abuse_case
	    WHERE abuse_case."sandboxId" = sandbox.id AND abuse_case.status <> ?
	  )
	LIMIT ?`;

@Injectable()
export class AbuseCaseService {
	private readonly logger = new Logger(AbuseCaseService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly orm: MikroORM,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly ladder: AbuseLadderService,
		private readonly actions: AbuseCaseActionService
	) {}

	async list(query: AbuseCaseListQueryDto): Promise<CursorPage<AbuseCaseDto>> {
		const page = await findCursorPage(this.entityManager, AbuseCase, {
			where: query.status ? { status: query.status } : {},
			orderBy: { lastSeenAt: QueryOrder.DESC, id: QueryOrder.DESC },
			limit: query.limit,
			cursor: query.cursor,
		});
		return { ...page, items: page.items.map(AbuseCaseDto.from) };
	}

	async resolve(caseId: string, resolvedBy: string): Promise<AbuseCaseDto> {
		return AbuseCaseDto.from(await this.actions.resolve(caseId, resolvedBy));
	}

	async releaseQuietCases(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			ABUSE_THROTTLE_RELEASE_JOB.lockKey,
			ABUSE_THROTTLE_RELEASE_JOB.lockTtlSeconds,
			() =>
				RequestContext.create(this.orm.em, async () => {
					await this.releaseQuiet();
					await this.releaseOrphanedControls();
				})
		);
	}

	private async releaseQuiet(): Promise<void> {
		const manager = this.entityManager.fork();
		const now = await databaseNow(manager);
		const quietSince = new Date(
			now.getTime() - ABUSE_LADDER.releaseAfterQuietMilliseconds
		);
		const quiet = await manager.find(
			AbuseCase,
			{
				status: { $in: [AbuseCaseStatus.OBSERVED, AbuseCaseStatus.THROTTLED] },
				manual: false,
				lastSeenAt: { $lt: quietSince },
			},
			{
				fields: ['id'],
				orderBy: { lastSeenAt: QueryOrder.ASC },
				limit: ABUSE_THROTTLE_RELEASE_JOB.batchSize,
			}
		);
		for (const { id } of quiet) {
			await this.ladder
				.release(id, null)
				.catch((error: unknown) =>
					this.logger.warn(
						`Could not release quiet abuse case ${id}: ${errorMessage(error)}`
					)
				);
		}
	}

	private async releaseOrphanedControls(): Promise<void> {
		const rows = await this.entityManager
			.fork()
			.execute<IdentifierRow[]>(ORPHANED_CONTROLS_SQL, [
				SandboxState.DESTROYED,
				AbuseCaseStatus.RESOLVED,
				ABUSE_THROTTLE_RELEASE_JOB.batchSize,
			]);
		for (const { id } of rows) {
			await this.ladder.releaseControls(id);
		}
	}
}
