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
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { ToArray } from './to-array.decorator';

interface EnumArrayQueryOptions {
	enum: object;
	enumName: string;
	description: string;
}

export function EnumArrayQuery(options: EnumArrayQueryOptions) {
	return applyDecorators(
		ApiPropertyOptional({
			enum: options.enum,
			enumName: options.enumName,
			description: options.description,
			isArray: true,
		}),
		IsOptional(),
		ToArray(),
		IsArray(),
		IsEnum(options.enum, { each: true })
	);
}
