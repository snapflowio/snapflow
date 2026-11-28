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
import { AbuseReportCategory } from '../../constants/abuse-report.constants';
import { abuseReportBacklog } from '../../queries/abuse-report-backlog.query';
import {
	counterNoticesForwardOverdue,
	counterNoticesPastRestoreBy,
} from '../../queries/counter-notice.query';

const reportInstruments = lazyInstrument((meter) => ({
	meter,
	open: meter.createObservableGauge(METRIC_NAME.ABUSE_REPORTS_OPEN, {
		description: 'Abuse reports waiting for a decision, by category',
		unit: METRIC_UNIT.REPORTS,
	}),
	overdue: meter.createObservableGauge(METRIC_NAME.ABUSE_REPORTS_OVERDUE, {
		description:
			'Abuse reports past their response target without a decision, by category',
		unit: METRIC_UNIT.REPORTS,
	}),
	pastRestoreBy: meter.createObservableGauge(
		METRIC_NAME.ABUSE_COUNTER_NOTICES_PAST_RESTORE_BY,
		{
			description:
				'Counter-noticed copyright reports past their restore-by time without a restoration or court action',
			unit: METRIC_UNIT.REPORTS,
		}
	),
	forwardOverdue: meter.createObservableGauge(
		METRIC_NAME.ABUSE_COUNTER_NOTICES_FORWARD_OVERDUE,
		{
			description:
				'Counter-notices whose complainant copy was not sent within one business day of receipt',
			unit: METRIC_UNIT.REPORTS,
		}
	),
}));

@Injectable()
export class AbuseReportMetricsService
	implements OnApplicationBootstrap, OnModuleDestroy
{
	constructor(private readonly entityManager: EntityManager) {}

	private readonly observe: BatchObservableCallback = async (result) => {
		const { open, overdue, pastRestoreBy, forwardOverdue } =
			reportInstruments();
		const [rows, pastDeadline, unforwarded] = await Promise.all([
			abuseReportBacklog(this.entityManager.fork()),
			counterNoticesPastRestoreBy(this.entityManager.fork()),
			counterNoticesForwardOverdue(this.entityManager.fork()),
		]);
		result.observe(pastRestoreBy, pastDeadline);
		result.observe(forwardOverdue, unforwarded);
		const byCategory = new Map(rows.map((row) => [row.category, row]));
		for (const category of Object.values(AbuseReportCategory)) {
			const attributes = { [METRIC_ATTRIBUTE.ABUSE_CATEGORY]: category };
			const row = byCategory.get(category);
			result.observe(open, row?.open ?? 0, attributes);
			result.observe(overdue, row?.overdue ?? 0, attributes);
		}
	};

	onApplicationBootstrap(): void {
		const { meter, open, overdue, pastRestoreBy, forwardOverdue } =
			reportInstruments();
		meter.addBatchObservableCallback(this.observe, [
			open,
			overdue,
			pastRestoreBy,
			forwardOverdue,
		]);
	}

	onModuleDestroy(): void {
		const { meter, open, overdue, pastRestoreBy, forwardOverdue } =
			reportInstruments();
		meter.removeBatchObservableCallback(this.observe, [
			open,
			overdue,
			pastRestoreBy,
			forwardOverdue,
		]);
	}
}
