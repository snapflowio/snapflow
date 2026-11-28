/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	Injectable,
	type OnApplicationBootstrap,
	type OnModuleDestroy,
} from '@nestjs/common';
import type { BatchObservableCallback } from '@opentelemetry/api';
import {
	METRIC_ATTRIBUTE,
	METRIC_NAME,
	METRIC_UNIT,
} from '../../../infra/metrics/constants/metrics.constants';
import { lazyInstrument } from '../../../infra/metrics/utils/snapflow-meter.util';
import { RealtimeOutboxStatus } from '../../constants/realtime-outbox.constants';
import {
	REALTIME_OUTBOX_BACKLOG_STATUSES,
	realtimeOutboxBacklog,
} from '../../queries/realtime-outbox-backlog.query';

const outboxInstruments = lazyInstrument((meter) => ({
	meter,
	events: meter.createObservableGauge(METRIC_NAME.REALTIME_OUTBOX_EVENTS, {
		description: 'Realtime outbox events not yet published, by status',
		unit: METRIC_UNIT.EVENTS,
	}),
	oldestPendingAge: meter.createObservableGauge(
		METRIC_NAME.REALTIME_OUTBOX_OLDEST_PENDING_AGE,
		{
			description: 'Age of the oldest realtime outbox event still pending',
			unit: METRIC_UNIT.SECONDS,
		}
	),
}));

@Injectable()
export class RealtimeOutboxMetricsService
	implements OnApplicationBootstrap, OnModuleDestroy
{
	constructor(private readonly entityManager: EntityManager) {}

	private readonly observe: BatchObservableCallback = async (result) => {
		const { events, oldestPendingAge } = outboxInstruments();
		const rows = await realtimeOutboxBacklog(this.entityManager.fork());
		const byStatus = new Map(rows.map((row) => [row.status, row]));
		for (const status of REALTIME_OUTBOX_BACKLOG_STATUSES) {
			result.observe(events, byStatus.get(status)?.events ?? 0, {
				[METRIC_ATTRIBUTE.OUTBOX_STATUS]: status,
			});
		}
		result.observe(
			oldestPendingAge,
			byStatus.get(RealtimeOutboxStatus.PENDING)?.oldestAgeSeconds ?? 0
		);
	};

	onApplicationBootstrap(): void {
		const { meter, events, oldestPendingAge } = outboxInstruments();
		meter.addBatchObservableCallback(this.observe, [events, oldestPendingAge]);
	}

	onModuleDestroy(): void {
		const { meter, events, oldestPendingAge } = outboxInstruments();
		meter.removeBatchObservableCallback(this.observe, [
			events,
			oldestPendingAge,
		]);
	}
}
