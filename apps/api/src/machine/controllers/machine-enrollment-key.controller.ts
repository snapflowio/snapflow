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
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	Audit,
	type TypedRequest,
} from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	MACHINE_ENROLLMENT_KEY_CREATOR_PERMISSIONS,
	MACHINE_ENROLLMENT_KEY_READER_PERMISSIONS,
} from '../../auth/constants/machine-enrollment-key.constants';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import {
	CreatedMachineEnrollmentKeyDto,
	CreateMachineEnrollmentKeyDto,
	MachineEnrollmentKeyListDto,
} from '../dto/machine-enrollment-key.dto';
import { MachineEnrollmentKeyDirectoryService } from '../services/enrollment/machine-enrollment-key-directory.service';

@Controller('machines/enrollment-keys')
@ApiTags(OpenApiTag.MACHINES)
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
export class MachineEnrollmentKeyController {
	constructor(private readonly keys: MachineEnrollmentKeyDirectoryService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary:
			'Create an enrollment key for the active organization and the command that installs and enrolls a machine with it',
		operationId: 'createMachineEnrollmentKey',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		type: CreatedMachineEnrollmentKeyDto,
	})
	@RequiredOrganizationPermissions({
		machines: [...MACHINE_ENROLLMENT_KEY_CREATOR_PERMISSIONS.machines],
		apiKey: [...MACHINE_ENROLLMENT_KEY_CREATOR_PERMISSIONS.apiKey],
	})
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.API_KEY,
		targetIdFromResult: (result: CreatedMachineEnrollmentKeyDto) => result.id,
		requestMetadata: {
			body: (request: TypedRequest<CreateMachineEnrollmentKeyDto>) => ({
				name: request.body?.name,
				singleUse: request.body?.singleUse,
				expiresIn: request.body?.expiresIn,
			}),
		},
	})
	create(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: CreateMachineEnrollmentKeyDto
	): Promise<CreatedMachineEnrollmentKeyDto> {
		return this.keys.create(authContext, input);
	}

	@Get()
	@ApiOperation({
		summary: "List the active organization's enrollment keys, newest first",
		operationId: 'listMachineEnrollmentKeys',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineEnrollmentKeyListDto })
	@RequiredOrganizationPermissions({
		machines: [...MACHINE_ENROLLMENT_KEY_READER_PERMISSIONS.machines],
	})
	list(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<MachineEnrollmentKeyListDto> {
		return this.keys.list(authContext.organizationId);
	}

	@Delete(':keyId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Revoke an enrollment key; machines it enrolled stay enrolled',
		operationId: 'revokeMachineEnrollmentKey',
	})
	@ApiParam({ name: 'keyId', format: 'uuid' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@RequiredOrganizationPermissions({
		machines: [...MACHINE_ENROLLMENT_KEY_CREATOR_PERMISSIONS.machines],
	})
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.API_KEY,
		targetIdFromRequest: (request) => request.params.keyId,
	})
	revoke(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('keyId', ParseUUIDPipe) keyId: string
	): Promise<void> {
		return this.keys.revoke(authContext.organizationId, keyId);
	}
}
