/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MAXIMUM_SEARCH_QUERY_LENGTH } from '../constants/query.constants';

export function SearchQuery(description: string) {
	return applyDecorators(
		ApiPropertyOptional({
			description,
			maxLength: MAXIMUM_SEARCH_QUERY_LENGTH,
		}),
		IsOptional(),
		IsString(),
		IsNotEmpty(),
		MaxLength(MAXIMUM_SEARCH_QUERY_LENGTH)
	);
}
