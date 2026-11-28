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
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Put,
	Query,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Audit } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredSystemRole } from '../decorators/required-system-role.decorator';
import {
	AdminUserDto,
	AdminUserListQueryDto,
	AdminUserPageDto,
	SetRestrictedEvidenceAccessDto,
} from '../dto/admin-user.dto';
import { SystemRole } from '../enums/system-role.enum';
import { AdminUserService } from '../services/admin-user.service';

@Controller('admin/users')
@ApiTags(OpenApiTag.ADMIN)
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
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

	@Get(':userId')
	@ApiOperation({ summary: 'Get a user', operationId: 'adminGetUser' })
	@ApiParam({ name: 'userId', description: 'User ID' })
	@ApiResponse({ status: HttpStatus.OK, type: AdminUserDto })
	get(@Param('userId', ParseUUIDPipe) userId: string): Promise<AdminUserDto> {
		return this.users.get(userId);
	}

	@Put(':userId/restricted-evidence-access')
	@ApiOperation({
		summary:
			'Grant or revoke access to restricted abuse evidence; only admins who hold it can change it',
		operationId: 'adminSetRestrictedEvidenceAccess',
	})
	@ApiParam({ name: 'userId', description: 'User ID' })
	@ApiResponse({ status: HttpStatus.OK, type: AdminUserDto })
	@Audit({
		action: AuditAction.SET_RESTRICTED_EVIDENCE_ACCESS,
		targetType: AuditTarget.USER,
		targetIdFromRequest: (request) => request.params.userId,
	})
	setRestrictedEvidenceAccess(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('userId', ParseUUIDPipe) userId: string,
		@Body() access: SetRestrictedEvidenceAccessDto
	): Promise<AdminUserDto> {
		return this.users.setRestrictedEvidenceAccess(
			context.userId,
			userId,
			access.granted
		);
	}
}
