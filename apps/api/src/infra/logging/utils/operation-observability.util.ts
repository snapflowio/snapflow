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
	type Attributes,
	metrics,
	SpanStatusCode,
	trace,
} from '@opentelemetry/api';
import { toError } from '../../../common/utils/error/error.util';

const INSTRUMENTATION_SCOPE = 'snapflow.control-plane';
const OPERATION_DURATION_METRIC = 'snapflow.operation.duration';

const tracer = trace.getTracer(INSTRUMENTATION_SCOPE);
const duration = metrics
	.getMeter(INSTRUMENTATION_SCOPE)
	.createHistogram(OPERATION_DURATION_METRIC, {
		description: 'Duration of bounded Snapflow control-plane operations',
		unit: 'ms',
	});

type OperationAttributes = Attributes & {
	'operation.outcome'?: 'success' | 'error';
};

export function recordOperationDuration(
	name: string,
	durationMilliseconds: number,
	metricAttributes: Attributes
): void {
	duration.record(durationMilliseconds, {
		...metricAttributes,
		'operation.name': name,
	});
}

export function observeOperation<T>(
	name: string,
	metricAttributes: Attributes,
	operation: () => Promise<T>,
	spanAttributes: Attributes = {}
): Promise<T> {
	return tracer.startActiveSpan(
		name,
		{ attributes: spanAttributes },
		async (span) => {
			const startedAt = performance.now();
			let outcome: OperationAttributes['operation.outcome'] = 'success';
			try {
				return await operation();
			} catch (error: unknown) {
				outcome = 'error';
				span.recordException(toError(error));
				span.setStatus({ code: SpanStatusCode.ERROR });
				throw error;
			} finally {
				recordOperationDuration(name, performance.now() - startedAt, {
					...metricAttributes,
					'operation.outcome': outcome,
				});
				span.end();
			}
		}
	);
}
