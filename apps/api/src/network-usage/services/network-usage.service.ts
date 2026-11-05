/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type FilterQuery, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { v4 } from 'uuid';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { EXPOSURE_KIND } from '../../networking/constants/exposure.constants';
import type { EdgeUsageSampleDto } from '../../networking/dto/edge-usage.dto';
import type { EdgeUsageCheckpoint } from '../../networking/entities/edge-usage-checkpoint.entity';
import { Exposure } from '../../networking/entities/exposure.entity';
import type { ExposureBackend } from '../../networking/entities/exposure-backend.entity';
import { SOFT_DELETED_SANDBOX_NAME_PREFIX } from '../../sandbox/constants/sandbox.constants';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import type { ListNetworkUsageQueryDto } from '../dto/network-usage.dto';
import { ExposureNetworkUsage } from '../entities/exposure-network-usage.entity';
import { NetworkUsagePeriod } from '../entities/network-usage-period.entity';

type PeriodParty = 'customerOrganizationId' | 'hostOrganizationId';

@Injectable()
export class NetworkUsageService {
	constructor(private readonly entityManager: EntityManager) {}

	customerPeriods(
		organizationId: string,
		query: ListNetworkUsageQueryDto
	): Promise<CursorPage<NetworkUsagePeriod>> {
		return this.periods('customerOrganizationId', organizationId, query);
	}

	hostPeriods(
		organizationId: string,
		query: ListNetworkUsageQueryDto
	): Promise<CursorPage<NetworkUsagePeriod>> {
		return this.periods('hostOrganizationId', organizationId, query);
	}

	async sandboxNames(
		organizationId: string,
		sandboxIds: readonly string[]
	): Promise<Map<string, string>> {
		if (sandboxIds.length === 0) return new Map();
		const sandboxes = await this.entityManager.fork().find(
			Sandbox,
			{
				id: { $in: [...new Set(sandboxIds)] },
				organizationId,
				name: { $not: { $like: `${SOFT_DELETED_SANDBOX_NAME_PREFIX}%` } },
			},
			{ fields: ['id', 'name'] }
		);
		return new Map(sandboxes.map((sandbox) => [sandbox.id, sandbox.name]));
	}

	async recordEdgeCheckpoint(
		manager: EntityManager,
		checkpoint: EdgeUsageCheckpoint,
		samples: readonly EdgeUsageSampleDto[],
		backends: ReadonlyMap<string, ExposureBackend>
	): Promise<void> {
		const exposureIds = [
			...new Set(
				samples
					.map(({ backendId }) => backends.get(backendId)?.exposureId)
					.filter((value): value is string => value !== undefined)
			),
		];
		const exposures =
			exposureIds.length === 0
				? []
				: await manager.find(Exposure, { id: { $in: exposureIds } });
		const exposureById = new Map(
			exposures.map((exposure) => [exposure.id, exposure])
		);
		const recordedAt = await databaseNow(manager);
		const records = samples.map((sample) => {
			const backend = backends.get(sample.backendId);
			const exposure = backend
				? exposureById.get(backend.exposureId)
				: undefined;
			if (!backend || !exposure) {
				throw new Error('Validated Edge usage ownership is unavailable');
			}
			return manager.create(ExposureNetworkUsage, {
				id: v4(),
				edgeCheckpointId: checkpoint.id,
				backendId: backend.id,
				exposureId: exposure.id,
				organizationId: exposure.organizationId,
				sandboxId: backend.sandboxId,
				placementId: backend.placementId,
				machineId: backend.machineId,
				edgeId: backend.edgeId,
				assignmentGeneration: sample.assignmentGeneration,
				protocol: sample.protocol,
				intervalStartedAt: checkpoint.intervalStartedAt,
				intervalEndedAt: checkpoint.intervalEndedAt,
				edgeBytesIn: sample.bytesIn,
				edgeBytesOut: sample.bytesOut,
				edgePacketsIn: sample.packetsIn,
				edgePacketsOut: sample.packetsOut,
				billable: exposure.kind !== EXPOSURE_KIND.SYSTEM,
				periodId: null,
				createdAt: recordedAt,
			});
		});
		manager.persist(records);
	}

	private periods(
		party: PeriodParty,
		organizationId: string,
		query: ListNetworkUsageQueryDto
	): Promise<CursorPage<NetworkUsagePeriod>> {
		const where: FilterQuery<NetworkUsagePeriod> = { [party]: organizationId };
		if (query.from || query.to) {
			where.periodStart = {
				...(query.from ? { $gte: query.from } : {}),
				...(query.to ? { $lt: query.to } : {}),
			};
		}
		return findCursorPage(this.entityManager, NetworkUsagePeriod, {
			where,
			orderBy: { periodStart: QueryOrder.DESC, id: QueryOrder.DESC },
			limit: query.limit,
			cursor: query.cursor,
		});
	}
}
