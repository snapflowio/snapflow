/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DEFAULT_PAGE_LIMIT } from '../constants/query.constants';
import { PageLimit } from '../decorators/page-limit.decorator';

export interface CursorPage<T> {
	items: T[];
	nextCursor: string | null;
}

@ApiSchema({ name: 'CursorPageQuery' })
export class CursorPageQueryDto {
	@ApiPropertyOptional({
		type: String,
		description: 'Opaque cursor returned by the previous page',
	})
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	cursor?: string;

	@PageLimit()
	limit = DEFAULT_PAGE_LIMIT;
}

export abstract class CursorPageDto<T> implements CursorPage<T> {
	@ApiProperty({ isArray: true })
	items: T[];

	@ApiProperty({ type: String, nullable: true })
	nextCursor: string | null;
}
