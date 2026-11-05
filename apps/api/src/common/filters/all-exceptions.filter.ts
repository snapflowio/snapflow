/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { STATUS_CODES } from 'node:http';
import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from '@nestjs/common';
import { isAPIError } from 'better-auth/api';
import { Request, Response } from 'express';
import { normalizeHttpExceptionResponse } from '../utils/error/http-exception-response.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const normalizedException = exception;

		let statusCode: number;
		let error: string;
		let message: string;
		let details: Record<string, unknown> = {};

		if (normalizedException instanceof HttpException) {
			statusCode = normalizedException.getStatus();
			error = STATUS_CODES[statusCode] ?? 'HTTP Error';
			({ details, message } = normalizeHttpExceptionResponse(
				normalizedException.getResponse(),
				normalizedException.message
			));
		} else if (isAPIError(normalizedException)) {
			statusCode = normalizedException.statusCode;
			error = STATUS_CODES[statusCode] ?? 'HTTP Error';
			({ details, message } = normalizeHttpExceptionResponse(
				normalizedException.body ?? {},
				normalizedException.message
			));
		} else {
			this.logger.error(normalizedException);
			error =
				STATUS_CODES[HttpStatus.INTERNAL_SERVER_ERROR] ??
				'Internal Server Error';
			message = 'An unexpected error occurred.';
			statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
		}

		response.status(statusCode).json({
			...details,
			path: request.url,
			timestamp: new Date().toISOString(),
			statusCode,
			error,
			message,
		});
	}
}
