/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators } from '@nestjs/common';
import { ApiDefaultResponse, ApiExtraModels } from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-error.dto';

const API_ERROR_RESPONSE_DESCRIPTION =
	'Error with a stable code and a message that says what to do next';

export function ApiErrorResponse(): MethodDecorator & ClassDecorator {
	return applyDecorators(
		ApiExtraModels(ApiErrorDto),
		ApiDefaultResponse({
			description: API_ERROR_RESPONSE_DESCRIPTION,
			type: ApiErrorDto,
		})
	);
}
