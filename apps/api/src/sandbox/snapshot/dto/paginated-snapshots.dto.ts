/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { CursorPageDto } from '../../../common/dto/cursor-page.dto';
import { SnapshotDto } from './snapshot.dto';

@ApiSchema({ name: 'SnapshotPage' })
export class SnapshotPageDto extends CursorPageDto<SnapshotDto> {
	@ApiProperty({ type: [SnapshotDto] })
	declare items: SnapshotDto[];
}
