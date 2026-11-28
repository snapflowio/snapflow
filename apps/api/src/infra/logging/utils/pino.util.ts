/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import pino, { TransportSingleOptions } from 'pino';
import { TypedConfigService } from '../../../config/services/typed-config.service';

const REDACTED_LOG_VALUE = '[Redacted]';
const SENSITIVE_HTTP_LOG_PATHS = [
	'req.headers.authorization',
	'req.headers.cookie',
	'req.headers.dpop',
	'req.headers["proxy-authorization"]',
	'req.headers["x-api-key"]',
	'req.headers["x-snapflow-edge-session-token"]',
	'req.body',
	'res.body',
	'res.headers["set-cookie"]',
];
const STACK_FRAME_MARKER = 'at ';
const LINE_BREAK = '\n';
const CONTEXT_MESSAGE_DETAIL_ARGUMENTS = 3;
const MESSAGE_DETAIL_ARGUMENTS = 2;

type LogContext = Record<string, unknown>;

interface SwappedArguments {
	context: LogContext;
	message: string;
}

export function getPinoRedaction() {
	return {
		censor: REDACTED_LOG_VALUE,
		paths: [...SENSITIVE_HTTP_LOG_PATHS],
	};
}

export function swapMessageAndObject(
	this: pino.Logger,
	args: Parameters<pino.LogFn>,
	method: pino.LogFn
): void {
	const values: readonly unknown[] = args;
	const [first, second, third] = values;
	if (isPlainObject(first)) {
		const contextual = swapped(second, third);
		if (contextual) {
			method.apply(this, [
				{ ...first, ...contextual.context },
				contextual.message,
				...values.slice(CONTEXT_MESSAGE_DETAIL_ARGUMENTS),
			]);
			return;
		}
	}
	const plain = swapped(first, second);
	if (plain) {
		method.apply(this, [
			plain.context,
			plain.message,
			...values.slice(MESSAGE_DETAIL_ARGUMENTS),
		]);
		return;
	}
	method.apply(this, args);
}

function swapped(message: unknown, detail: unknown): SwappedArguments | null {
	if (typeof message !== 'string') return null;
	const context = detailContext(detail);
	return context ? { context, message } : null;
}

function detailContext(detail: unknown): LogContext | null {
	if (detail instanceof Error) return { err: detail };
	if (isPlainObject(detail)) return detail;
	if (isStackTrace(detail)) return { stack: detail };
	return null;
}

function isPlainObject(value: unknown): value is LogContext {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStackTrace(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.includes(LINE_BREAK) &&
		value.includes(STACK_FRAME_MARKER)
	);
}

type LogConfig = ReturnType<typeof TypedConfigService.prototype.get<'log'>>;

export function getPinoTransport(
	logConfig: LogConfig
): TransportSingleOptions<Record<string, unknown>> | undefined {
	if (!logConfig.pretty) return undefined;
	return {
		target: 'pino-pretty',
		options: {
			colorize: true,
			singleLine: true,
			ignore: 'pid,hostname',
		},
	};
}
