/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

@ApiSchema({ name: 'SetSnapshotGeneralStatusDto' })
export class SetSnapshotGeneralStatusDto {
	@ApiProperty({
		description: 'Whether the snapshot is general',
		example: true,
	})
	@IsBoolean()
	general: boolean;
}
