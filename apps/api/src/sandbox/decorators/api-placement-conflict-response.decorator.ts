/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators, HttpStatus, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

const PLACEMENT_CONFLICT_DESCRIPTION =
	'The placement cannot proceed; the code names the reason';

export function ApiPlacementConflictResponse(
	...errors: [Type, ...Type[]]
): MethodDecorator & ClassDecorator {
	return applyDecorators(
		ApiExtraModels(...errors),
		ApiResponse({
			status: HttpStatus.CONFLICT,
			description: PLACEMENT_CONFLICT_DESCRIPTION,
			schema: {
				oneOf: errors.map((error) => ({ $ref: getSchemaPath(error) })),
			},
		})
	);
}
