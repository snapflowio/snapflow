/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { CursorPageQueryDto } from '../../common/dto/cursor-page.dto';

@ApiSchema({ name: 'ListAuditLogsQuery' })
export class ListAuditLogsQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description: 'From date (ISO 8601 format)',
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	from?: Date;

	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description: 'To date (ISO 8601 format)',
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	to?: Date;
}
