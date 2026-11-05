/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { SandboxClass } from '../../../sandbox/enums/sandbox-class.enum';

export class OrganizationQuotaParamsDto {
	@ApiProperty({ description: 'Organization ID' })
	@IsString()
	@IsNotEmpty()
	organizationId: string;

	@ApiProperty({ enum: SandboxClass, enumName: 'SandboxClass' })
	@IsEnum(SandboxClass)
	sandboxClass: SandboxClass;
}
