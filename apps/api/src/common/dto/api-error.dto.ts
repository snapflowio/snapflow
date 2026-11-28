/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { STATUS_CODES } from 'node:http';
import { HttpStatus } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	API_ERROR_CODE_SCHEMA_NAME,
	API_ERROR_CODES,
	COMMON_ERROR_MESSAGES,
} from '../constants/api-error-code.constants';
import { CommonErrorCode } from '../enums/common-error-code.enum';

@ApiSchema({ name: 'ApiError' })
export class ApiErrorDto {
	@ApiProperty({
		description: 'HTTP status code of the response',
		example: HttpStatus.NOT_FOUND,
	})
	statusCode: number;

	@ApiProperty({
		description: 'HTTP reason phrase for the status code',
		example: STATUS_CODES[HttpStatus.NOT_FOUND],
	})
	error: string;

	@ApiProperty({
		description:
			'Stable machine-readable error code. Branch on this value, never on the message text.',
		enum: API_ERROR_CODES,
		enumName: API_ERROR_CODE_SCHEMA_NAME,
		example: CommonErrorCode.NOT_FOUND,
	})
	code: string;

	@ApiProperty({
		description:
			'Human-readable explanation of what went wrong and what to do next',
		example: COMMON_ERROR_MESSAGES[CommonErrorCode.NOT_FOUND],
	})
	message: string;

	@ApiPropertyOptional({
		description: `Individual field failures when code is ${CommonErrorCode.VALIDATION_FAILED}`,
		type: [String],
	})
	errors?: string[];

	@ApiProperty({ description: 'Request path that failed' })
	path: string;

	@ApiProperty({
		description: 'Time the error occurred',
		format: 'date-time',
	})
	timestamp: string;
}
