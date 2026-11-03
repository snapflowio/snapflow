/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
	DEFAULT_PAGE_LIMIT,
	MAXIMUM_PAGE_LIMIT,
} from '../constants/query.constants';

export function PageLimit(
	defaultValue = DEFAULT_PAGE_LIMIT,
	maximum = MAXIMUM_PAGE_LIMIT
) {
	return applyDecorators(
		ApiProperty({
			name: 'limit',
			description: 'Number of results per page',
			required: false,
			type: Number,
			minimum: 1,
			maximum,
			default: defaultValue,
		}),
		IsOptional(),
		Type(() => Number),
		IsInt(),
		Min(1),
		Max(maximum)
	);
}
