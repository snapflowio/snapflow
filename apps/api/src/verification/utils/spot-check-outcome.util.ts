/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BenchmarkMeasurements } from '@snapflow/machine-proto';
import type { BenchmarkFailure } from '../constants/benchmark-policy.constants';
import type {
	SpotCheckAbort,
	SpotCheckFailure,
} from '../constants/spot-check.constants';
import { SpotCheckState } from '../enums/spot-check-state.enum';

export type SpotCheckOutcome =
	| { state: SpotCheckState.PASSED; measurements: BenchmarkMeasurements }
	| {
			state: SpotCheckState.FAILED;
			measurements: BenchmarkMeasurements;
			reasons: (BenchmarkFailure | SpotCheckFailure)[];
	  }
	| { state: SpotCheckState.ABORTED; reasons: SpotCheckAbort[] };

export function abortedSpotCheck(reason: SpotCheckAbort): SpotCheckOutcome {
	return { state: SpotCheckState.ABORTED, reasons: [reason] };
}

export function withCanaryFailures(
	outcome: SpotCheckOutcome,
	failures: readonly SpotCheckFailure[]
): SpotCheckOutcome {
	if (outcome.state === SpotCheckState.ABORTED || failures.length === 0) {
		return outcome;
	}
	return {
		state: SpotCheckState.FAILED,
		measurements: outcome.measurements,
		reasons:
			outcome.state === SpotCheckState.FAILED
				? [...outcome.reasons, ...failures]
				: [...failures],
	};
}
