/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

@ApiSchema({ name: 'ResizeSandbox' })
export class ResizeSandboxDto {
	@ApiPropertyOptional({
		description: 'CPU cores to allocate to the sandbox (minimum: 1)',
		example: 2,
		type: 'integer',
		minimum: 1,
	})
	@IsOptional()
	@IsNumber()
	@Min(1)
	cpu?: number;

	@ApiPropertyOptional({
		description: 'Memory in GB to allocate to the sandbox (minimum: 1)',
		example: 4,
		type: 'integer',
		minimum: 1,
	})
	@IsOptional()
	@IsNumber()
	@Min(1)
	memory?: number;

	@ApiPropertyOptional({
		description:
			'Disk space in GB to allocate to the sandbox (can only be increased)',
		example: 20,
		type: 'integer',
		minimum: 1,
	})
	@IsOptional()
	@IsNumber()
	@Min(1)
	disk?: number;
}
