/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import { RequiredSystemRole } from '../decorators/required-system-role.decorator';
import { AdminUserListQueryDto, AdminUserPageDto } from '../dto/admin-user.dto';
import { SystemRole } from '../enums/system-role.enum';
import { AdminUserService } from '../services/admin-user.service';

@Controller('admin/users')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminUserController {
	constructor(private readonly users: AdminUserService) {}

	@Get()
	@ApiOperation({
		summary: 'List and search users',
		operationId: 'adminListUsers',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AdminUserPageDto })
	list(@Query() query: AdminUserListQueryDto): Promise<AdminUserPageDto> {
		return this.users.list(query);
	}
}
