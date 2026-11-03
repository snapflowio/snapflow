/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import {
	ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
	ATTR_SERVICE_INSTANCE_ID,
} from '@opentelemetry/semantic-conventions/incubating';
import { currentProcess } from './config/utils/current-process.util';

const SERVICE_NAME_PREFIX = 'snapflow';

let telemetrySdk: NodeSDK | undefined;

export function startTelemetry(): void {
	const { role, profile, values } = currentProcess();
	if (!values.OTEL_EXPORTER_OTLP_ENDPOINT || telemetrySdk) return;
	telemetrySdk = new NodeSDK({
		resource: resourceFromAttributes({
			[ATTR_SERVICE_NAME]: `${SERVICE_NAME_PREFIX}-${role}`,
			[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: profile.name,
			[ATTR_SERVICE_INSTANCE_ID]: randomUUID(),
		}),
		instrumentations: [
			new PinoInstrumentation(),
			new HttpInstrumentation({ requireParentforOutgoingSpans: true }),
			new ExpressInstrumentation(),
			new NestInstrumentation(),
			new IORedisInstrumentation({ requireParentSpan: true }),
			new PgInstrumentation({ requireParentSpan: true }),
		],
		spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
	});
	telemetrySdk.start();
}

export async function stopTelemetry(): Promise<void> {
	const sdk = telemetrySdk;
	telemetrySdk = undefined;
	if (sdk) {
		await sdk.shutdown();
	}
}
