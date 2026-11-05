/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../common/dto/cursor-page.dto';
import { SandboxDto } from './sandbox.dto';

@ApiSchema({ name: 'ListSandboxForksQuery' })
export class ListSandboxForksQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({ type: Boolean, default: false })
	@IsOptional()
	@Transform(({ value }) => value === true || value === 'true')
	@IsBoolean()
	includeDestroyed = false;
}

@ApiSchema({ name: 'SandboxPage' })
export class SandboxPageDto extends CursorPageDto<SandboxDto> {
	@ApiProperty({ type: SandboxDto, isArray: true })
	declare items: SandboxDto[];
}
