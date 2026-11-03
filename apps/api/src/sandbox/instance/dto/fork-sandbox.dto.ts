/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IsSafeDisplayString } from '../../../common/validators/is-safe-string.validator';

@ApiSchema({ name: 'ForkSandbox' })
export class ForkSandboxDto {
	@ApiPropertyOptional({
		description:
			'The name for the forked sandbox. If not provided, a unique name will be generated.',
		example: 'my-forked-sandbox',
	})
	@IsOptional()
	@IsString()
	@IsSafeDisplayString()
	name?: string;
}
