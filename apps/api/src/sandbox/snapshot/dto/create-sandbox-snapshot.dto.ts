/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsSafeDisplayString } from '../../../common/validators/is-safe-string.validator';

@ApiSchema({ name: 'CreateSandboxSnapshot' })
export class CreateSandboxSnapshotDto {
	@ApiProperty({
		description: 'Name for the new snapshot',
		example: 'my-dev-env-v1',
	})
	@IsString()
	@IsSafeDisplayString()
	name: string;
}
