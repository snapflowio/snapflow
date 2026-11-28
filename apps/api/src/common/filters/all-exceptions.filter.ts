/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

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
import { COMMON_ERROR_MESSAGES } from '../constants/api-error-code.constants';
import { CommonErrorCode } from '../enums/common-error-code.enum';
import {
	apiErrorBody,
	type NormalizedErrorResponse,
	normalizeErrorResponse,
} from '../utils/error/http-exception-response.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		let statusCode: number;
		let normalized: NormalizedErrorResponse;

		if (exception instanceof HttpException) {
			statusCode = exception.getStatus();
			normalized = normalizeErrorResponse(
				exception.getResponse(),
				exception.message,
				statusCode
			);
		} else if (isAPIError(exception)) {
			statusCode = exception.statusCode;
			normalized = normalizeErrorResponse(
				exception.body ?? {},
				exception.message,
				statusCode
			);
		} else {
			this.logger.error(exception);
			statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
			normalized = {
				details: {},
				code: CommonErrorCode.INTERNAL_ERROR,
				message: COMMON_ERROR_MESSAGES[CommonErrorCode.INTERNAL_ERROR],
			};
		}

		response
			.status(statusCode)
			.json(apiErrorBody(request.originalUrl, statusCode, normalized));
	}
}
