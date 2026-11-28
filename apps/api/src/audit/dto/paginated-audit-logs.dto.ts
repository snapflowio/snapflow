/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import { AuditLogDto } from './audit-log.dto';

@ApiSchema({ name: 'AuditLogPage' })
export class AuditLogPageDto extends CursorPageDto<AuditLogDto> {
	@ApiProperty({ type: [AuditLogDto] })
	declare items: AuditLogDto[];
}
