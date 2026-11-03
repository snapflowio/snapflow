/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

const MAXIMUM_VOLUME_SIZE_GIB = 16_384;

export class ResizeVolumeDto {
	@ApiProperty({
		description: 'New volume size in GiB. Persistent volumes cannot shrink.',
		minimum: 1,
		maximum: MAXIMUM_VOLUME_SIZE_GIB,
	})
	@IsInt()
	@Min(1)
	@Max(MAXIMUM_VOLUME_SIZE_GIB)
	targetSizeGiB: number;
}
