/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	METRIC_ATTRIBUTE,
	METRIC_NAME,
	METRIC_UNIT,
} from '../constants/metrics.constants';
import { lazyInstrument, recordOutcome } from './snapflow-meter.util';

const emailSends = lazyInstrument((meter) =>
	meter.createCounter(METRIC_NAME.EMAIL_SENDS, {
		description: 'Transactional email deliveries by category and outcome',
		unit: METRIC_UNIT.EMAILS,
	})
);

export function measureEmailSend<Result>(
	category: string,
	send: () => Promise<Result>
): Promise<Result> {
	return recordOutcome(send, (outcome) =>
		emailSends().add(1, {
			[METRIC_ATTRIBUTE.EMAIL_CATEGORY]: category,
			[METRIC_ATTRIBUTE.OUTCOME]: outcome,
		})
	);
}
