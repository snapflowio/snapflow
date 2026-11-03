/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsDate,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Min,
} from 'class-validator';
import { DEFAULT_PAGE_LIMIT } from '../../../common/constants/query.constants';
import { PageLimit } from '../../../common/decorators/page-limit.decorator';
import { ToArray } from '../../../common/decorators/to-array.decorator';
import { IsLocationCode } from '../../../location/validators/is-location-code.validator';
import { SandboxClass } from '../enums/sandbox-class.enum';
import { SandboxState } from '../enums/sandbox-state.enum';

export enum SandboxListSortField {
	NAME = 'name',
	CPU = 'cpu',
	MEMORY = 'memory_gib',
	DISK = 'disk_gib',
	LAST_ACTIVITY_AT = 'last_activity_at',
	CREATED_AT = 'created_at',
}

export enum SandboxListSortDirection {
	ASC = 'asc',
	DESC = 'desc',
}

const DEFAULT_SANDBOX_LIST_SORT_FIELD = SandboxListSortField.LAST_ACTIVITY_AT;
const DEFAULT_SANDBOX_LIST_SORT_DIRECTION = SandboxListSortDirection.DESC;

const LIST_SANDBOXES_QUERY_VALID_STATES = Object.values(SandboxState).filter(
	(state) => state !== SandboxState.DESTROYED
);

@ApiSchema({ name: 'ListSandboxesQuery' })
export class ListSandboxesQueryDto {
	@ApiProperty({
		name: 'cursor',
		description: 'Pagination cursor from a previous response',
		required: false,
		type: String,
	})
	@IsOptional()
	@IsString()
	cursor?: string;

	@PageLimit()
	limit = DEFAULT_PAGE_LIMIT;

	@ApiProperty({
		name: 'id',
		description: 'Filter by ID prefix (case-insensitive)',
		required: false,
		type: String,
	})
	@IsOptional()
	@IsString()
	id?: string;

	@ApiProperty({
		name: 'name',
		description: 'Filter by name prefix (case-insensitive)',
		required: false,
		type: String,
	})
	@IsOptional()
	@IsString()
	name?: string;

	@ApiProperty({
		name: 'labels',
		description: 'JSON encoded labels to filter by',
		required: false,
		type: String,
		example: '{"label1": "value1", "label2": "value2"}',
	})
	@IsOptional()
	@IsString()
	labels?: string;

	@ApiProperty({
		name: 'includeErroredDeleted',
		description: 'Include results with errored state and deleted desired state',
		required: false,
		type: Boolean,
		default: false,
	})
	@IsOptional()
	@Transform(({ value }) => value === 'true' || value === true)
	@IsBoolean()
	includeErroredDeleted?: boolean;

	@ApiProperty({
		name: 'states',
		description: 'List of states to filter by.',
		required: false,
		enum: SandboxState,
		enumName: 'SandboxState',
		isArray: true,
	})
	@IsOptional()
	@ToArray()
	@IsArray()
	@IsEnum(LIST_SANDBOXES_QUERY_VALID_STATES, {
		each: true,
		message: `each value must be one of the following values: ${LIST_SANDBOXES_QUERY_VALID_STATES.join(', ')}`,
	})
	states?: SandboxState[];

	@ApiProperty({
		name: 'snapshots',
		description: 'List of snapshot names to filter by',
		required: false,
		type: [String],
	})
	@IsOptional()
	@ToArray()
	@IsArray()
	@IsString({ each: true })
	snapshots?: string[];

	@ApiProperty({
		name: 'locations',
		description:
			'Continents (e.g. europe) or ISO 3166-1 alpha-2 countries (e.g. DE) to filter by',
		required: false,
		type: [String],
	})
	@IsOptional()
	@ToArray()
	@IsArray()
	@IsLocationCode({ each: true })
	locations?: string[];

	@ApiProperty({
		name: 'sandboxClasses',
		description: 'List of sandbox classes to filter by',
		required: false,
		enum: SandboxClass,
		enumName: 'SandboxClass',
		isArray: true,
	})
	@IsOptional()
	@ToArray()
	@IsArray()
	@IsEnum(SandboxClass, { each: true })
	sandboxClasses?: SandboxClass[];

	@ApiProperty({
		name: 'minCpu',
		description: 'Minimum CPU',
		required: false,
		type: Number,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	minCpu?: number;

	@ApiProperty({
		name: 'maxCpu',
		description: 'Maximum CPU',
		required: false,
		type: Number,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	maxCpu?: number;

	@ApiProperty({
		name: 'minMemoryGiB',
		description: 'Minimum memory in GiB',
		required: false,
		type: Number,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	minMemoryGiB?: number;

	@ApiProperty({
		name: 'maxMemoryGiB',
		description: 'Maximum memory in GiB',
		required: false,
		type: Number,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	maxMemoryGiB?: number;

	@ApiProperty({
		name: 'minDiskGiB',
		description: 'Minimum disk space in GiB',
		required: false,
		type: Number,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	minDiskGiB?: number;

	@ApiProperty({
		name: 'maxDiskGiB',
		description: 'Maximum disk space in GiB',
		required: false,
		type: Number,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	maxDiskGiB?: number;

	@ApiProperty({
		name: 'isRecoverable',
		description: 'Filter by recoverable status',
		required: false,
		type: Boolean,
		default: undefined,
	})
	@IsOptional()
	@Transform(({ value }) => value === 'true' || value === true)
	@IsBoolean()
	isRecoverable?: boolean;

	@ApiProperty({
		name: 'createdAtAfter',
		description: 'Include items created after this timestamp',
		required: false,
		type: String,
		format: 'date-time',
		example: '2024-01-01T00:00:00Z',
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	createdAtAfter?: Date;

	@ApiProperty({
		name: 'createdAtBefore',
		description: 'Include items created before this timestamp',
		required: false,
		type: String,
		format: 'date-time',
		example: '2024-12-31T23:59:59Z',
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	createdAtBefore?: Date;

	@ApiProperty({
		name: 'lastEventAfter',
		description: 'Include items with last event after this timestamp',
		required: false,
		type: String,
		format: 'date-time',
		example: '2024-01-01T00:00:00Z',
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	lastEventAfter?: Date;

	@ApiProperty({
		name: 'lastEventBefore',
		description: 'Include items with last event before this timestamp',
		required: false,
		type: String,
		format: 'date-time',
		example: '2024-12-31T23:59:59Z',
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	lastEventBefore?: Date;

	@ApiProperty({
		name: 'sort',
		description: 'Field to sort by',
		required: false,
		enum: SandboxListSortField,
		enumName: 'SandboxListSortField',
		default: DEFAULT_SANDBOX_LIST_SORT_FIELD,
	})
	@IsOptional()
	@IsEnum(SandboxListSortField)
	sort = DEFAULT_SANDBOX_LIST_SORT_FIELD;

	@ApiProperty({
		name: 'order',
		description: 'Direction to sort by',
		required: false,
		enum: SandboxListSortDirection,
		enumName: 'SandboxListSortDirection',
		default: DEFAULT_SANDBOX_LIST_SORT_DIRECTION,
	})
	@IsOptional()
	@IsEnum(SandboxListSortDirection)
	order = DEFAULT_SANDBOX_LIST_SORT_DIRECTION;
}
