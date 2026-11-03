/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CursorPageQueryDto } from '../../../common/dto/cursor-page.dto';

export enum SnapshotSortField {
	NAME = 'name',
	STATE = 'state',
	LAST_USED_AT = 'last_used_at',
	CREATED_AT = 'created_at',
}

export enum SnapshotSortDirection {
	ASC = 'asc',
	DESC = 'desc',
}

@ApiSchema({ name: 'ListSnapshotsQuery' })
export class ListSnapshotsQueryDto extends CursorPageQueryDto {
	@ApiProperty({
		name: 'name',
		description: 'Filter by partial name match',
		required: false,
		type: String,
		example: 'abc123',
	})
	@IsOptional()
	@IsString()
	name?: string;

	@ApiProperty({
		name: 'sort',
		description: 'Field to sort by',
		required: false,
		enum: SnapshotSortField,
		default: SnapshotSortField.LAST_USED_AT,
	})
	@IsOptional()
	@IsEnum(SnapshotSortField)
	sort = SnapshotSortField.LAST_USED_AT;

	@ApiProperty({
		name: 'order',
		description: 'Direction to sort by',
		required: false,
		enum: SnapshotSortDirection,
		default: SnapshotSortDirection.DESC,
	})
	@IsOptional()
	@IsEnum(SnapshotSortDirection)
	order = SnapshotSortDirection.DESC;
}
