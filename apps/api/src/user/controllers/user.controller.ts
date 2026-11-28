/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { TermsAcceptanceExempt } from '../../legal/decorators/terms-acceptance-exempt.decorator';
import { AcceptLegalDocumentDto } from '../../legal/dto/accept-legal-document.dto';
import { assertAcceptedBySelf } from '../../legal/utils/legal-version.util';
import { UserDto } from '../dto/user.dto';
import { UserService } from '../services/user.service';
import { userNotFound } from '../utils/user-error.util';

@Controller('users')
@ApiTags(OpenApiTag.USERS)
@AllowAuthMethods([AuthMethod.SESSION, AuthMethod.API_KEY])
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
			throw new NotFoundException(userNotFound(authContext.userId));
		}
		return UserDto.from(user);
	}

	@Post('me/terms-acceptance')
	@TermsAcceptanceExempt()
	@HttpCode(HttpStatus.OK)
	@AllowAuthMethods([AuthMethod.SESSION])
	@ApiOperation({
		summary: 'Accept the current Terms of Service',
		operationId: 'acceptTerms',
	})
	@ApiResponse({ status: HttpStatus.OK, type: UserDto })
	async acceptTerms(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: AcceptLegalDocumentDto
	): Promise<UserDto> {
		assertAcceptedBySelf(authContext.credential);
		return UserDto.from(
			await this.userService.acceptTerms(authContext.userId, input.version)
		);
	}
}
