/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Controller,
	Get,
	HttpStatus,
	NotFoundException,
	UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { UserDto } from '../dto/user.dto';
import { UserService } from '../services/user.service';

@Controller('users')
@ApiTags('users')
@AllowAuthMethods([AuthMethod.SESSION, AuthMethod.API_KEY])
@UseGuards(AuthenticatedRateLimitGuard)
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Get('me')
	@ApiOperation({
		summary: 'Get authenticated user',
		operationId: 'getAuthenticatedUser',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'User details',
		type: UserDto,
	})
	async getAuthenticatedUser(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<UserDto> {
		const user = await this.userService.findOne(authContext.userId);
		if (!user) {
			throw new NotFoundException(
				`User with ID ${authContext.userId} not found`
			);
		}
		return UserDto.from(user);
	}
}
