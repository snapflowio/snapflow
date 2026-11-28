/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Meter, metrics } from '@opentelemetry/api';
import {
	MetricOutcome,
	SNAPFLOW_METER_NAME,
} from '../constants/metrics.constants';

export function lazyInstrument<Instrument>(
	create: (meter: Meter) => Instrument
): () => Instrument {
	let instrument: Instrument | undefined;
	return () => {
		instrument ??= create(metrics.getMeter(SNAPFLOW_METER_NAME));
		return instrument;
	};
}

export async function recordOutcome<Result>(
	run: () => Result | Promise<Result>,
	record: (outcome: MetricOutcome) => void
): Promise<Result> {
	try {
		const result = await run();
		record(MetricOutcome.SUCCESS);
		return result;
	} catch (error) {
		record(MetricOutcome.FAILURE);
		throw error;
	}
}
