/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { IsSafeDisplayString } from '../../../common/validators/is-safe-string.validator';

const MAXIMUM_CREATED_VOLUME_SIZE_GIB = 2_048;

@ApiSchema({ name: 'CreateVolume' })
export class CreateVolumeDto {
	@ApiProperty()
	@IsString()
	@IsSafeDisplayString()
	name: string;

	@ApiProperty({
		description: 'Persistent block volume size in GiB',
		example: 10,
		minimum: 1,
		maximum: MAXIMUM_CREATED_VOLUME_SIZE_GIB,
	})
	@IsInt()
	@Min(1)
	@Max(MAXIMUM_CREATED_VOLUME_SIZE_GIB)
	sizeGiB: number;
}
