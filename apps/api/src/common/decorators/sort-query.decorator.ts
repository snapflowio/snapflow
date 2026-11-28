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
import { IsEnum, IsOptional } from 'class-validator';
import { SortDirection } from '../enums/sort-direction.enum';

interface SortFieldQueryOptions {
	enum: object;
	enumName: string;
	default: string;
}

export function SortFieldQuery(options: SortFieldQueryOptions) {
	return applyDecorators(
		ApiPropertyOptional({
			enum: options.enum,
			enumName: options.enumName,
			default: options.default,
			description: 'Field to sort by',
		}),
		IsOptional(),
		IsEnum(options.enum)
	);
}

export function SortDirectionQuery(defaultValue: SortDirection) {
	return applyDecorators(
		ApiPropertyOptional({
			enum: SortDirection,
			enumName: 'SortDirection',
			default: defaultValue,
			description: 'Direction to sort by',
		}),
		IsOptional(),
		IsEnum(SortDirection)
	);
}
