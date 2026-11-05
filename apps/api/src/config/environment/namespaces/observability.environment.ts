/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';
import { httpUrlText } from '../utils/environment-schemas.util';
import {
	defineEnvironment,
	environmentVariable,
} from '../utils/environment-variable.util';

export const LOG_LEVELS = [
	'trace',
	'debug',
	'info',
	'warn',
	'error',
	'fatal',
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const observabilityEnvironment = defineEnvironment(
	{
		title: 'Observability',
		description: 'Logging and tracing',
	},
	{
		LOG_LEVEL: environmentVariable(z.enum(LOG_LEVELS).prefault('info'), {
			description:
				'Pino log level; debug also logs HTTP requests and times @LogExecution methods.',
		}),
		SQL_LOG_LEVEL: environmentVariable(z.enum(LOG_LEVELS), {
			description:
				'Most verbose log level that still logs SQL statements: they are logged while LOG_LEVEL is at or below it.',
		}),
		OTEL_EXPORTER_OTLP_ENDPOINT: environmentVariable(httpUrlText().optional(), {
			description:
				'OTLP/HTTP collector the traces are exported to; tracing is off without it. The standard OTEL_* variables tune the exporter.',
		}),
	}
);
