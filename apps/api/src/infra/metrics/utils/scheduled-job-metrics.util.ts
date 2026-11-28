/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { performance } from 'node:perf_hooks';
import {
	METRIC_ATTRIBUTE,
	METRIC_NAME,
	METRIC_UNIT,
	MILLISECONDS_PER_SECOND,
} from '../constants/metrics.constants';
import { lazyInstrument, recordOutcome } from './snapflow-meter.util';

const jobRuns = lazyInstrument((meter) =>
	meter.createCounter(METRIC_NAME.SCHEDULED_JOB_RUNS, {
		description: 'Scheduled job runs by job and outcome',
		unit: METRIC_UNIT.RUNS,
	})
);

const jobDuration = lazyInstrument((meter) =>
	meter.createHistogram(METRIC_NAME.SCHEDULED_JOB_DURATION, {
		description: 'Wall-clock duration of scheduled job runs',
		unit: METRIC_UNIT.SECONDS,
	})
);

export function measureScheduledJob<Result>(
	jobName: string,
	run: () => Result | Promise<Result>
): Promise<Result> {
	const startedAt = performance.now();
	return recordOutcome(run, (outcome) => {
		const attributes = {
			[METRIC_ATTRIBUTE.JOB_NAME]: jobName,
			[METRIC_ATTRIBUTE.OUTCOME]: outcome,
		};
		jobRuns().add(1, attributes);
		jobDuration().record(
			(performance.now() - startedAt) / MILLISECONDS_PER_SECOND,
			attributes
		);
	});
}
