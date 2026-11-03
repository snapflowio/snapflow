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
	Headers,
	HttpStatus,
	Patch,
	Put,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiHeader,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	Audit,
	type TypedRequest,
} from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../../auth/decorators/allow-auth-methods.decorator';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { parseRequiredResourceVersion } from '../../../infra/database/utils/resource-version.util';
import { RequiredSystemRole } from '../../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../../user/enums/system-role.enum';
import { SETTINGS_ID } from '../constants/settings.constants';
import { SettingsDto } from '../dto/settings.dto';
import {
	SetDrainingPolicyDto,
	SetMaintenanceModeDto,
	UpdateSettingsDto,
} from '../dto/update-settings.dto';
import { SettingsService } from '../services/settings.service';

const IF_MATCH_HEADER = 'if-match';
const SETTINGS_TARGET = () => String(SETTINGS_ID);
const SETTINGS_RESULT_METADATA = {
	resourceVersion: (result: SettingsDto) => result.resourceVersion,
};

@Controller('admin/settings')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminSettingsController {
	constructor(private readonly settings: SettingsService) {}

	@Get()
	@ApiOperation({
		summary: 'Get the settings',
		operationId: 'adminGetSettings',
	})
	@ApiResponse({ status: HttpStatus.OK, type: SettingsDto })
	async get(): Promise<SettingsDto> {
		return SettingsDto.from(await this.settings.get());
	}

	@Patch()
	@ApiOperation({
		summary: 'Update the settings',
		operationId: 'adminUpdateSettings',
	})
	@ApiHeader({
		name: IF_MATCH_HEADER,
		description: 'The resourceVersion the change is based on',
		required: true,
	})
	@ApiResponse({ status: HttpStatus.OK, type: SettingsDto })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.SETTINGS,
		targetIdFromRequest: SETTINGS_TARGET,
		requestMetadata: {
			expectedVersion: (request: TypedRequest<UpdateSettingsDto>) =>
				request.get(IF_MATCH_HEADER),
			body: (request: TypedRequest<UpdateSettingsDto>) => ({
				...request.body,
			}),
		},
		resultMetadata: SETTINGS_RESULT_METADATA,
	})
	async update(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Headers(IF_MATCH_HEADER) ifMatch: string | undefined,
		@Body() changes: UpdateSettingsDto
	): Promise<SettingsDto> {
		return SettingsDto.from(
			await this.settings.update(
				parseRequiredResourceVersion(ifMatch),
				changes,
				context.userId
			)
		);
	}

	@Put('maintenance')
	@ApiOperation({
		summary: 'Turn maintenance mode on or off',
		operationId: 'adminSetMaintenanceMode',
	})
	@ApiResponse({ status: HttpStatus.OK, type: SettingsDto })
	@Audit({
		action: AuditAction.SET_MAINTENANCE_MODE,
		targetType: AuditTarget.SETTINGS,
		targetIdFromRequest: SETTINGS_TARGET,
		requestMetadata: {
			body: (request: TypedRequest<SetMaintenanceModeDto>) => ({
				enabled: request.body?.enabled,
			}),
		},
		resultMetadata: SETTINGS_RESULT_METADATA,
	})
	async setMaintenanceMode(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Body() input: SetMaintenanceModeDto
	): Promise<SettingsDto> {
		return SettingsDto.from(
			await this.settings.set(
				{ maintenanceMode: input.enabled },
				context.userId
			)
		);
	}

	@Put('draining')
	@ApiOperation({
		summary: 'Set how draining machines move their sandboxes',
		operationId: 'adminSetDrainingPolicy',
	})
	@ApiResponse({ status: HttpStatus.OK, type: SettingsDto })
	@Audit({
		action: AuditAction.SET_DRAINING_POLICY,
		targetType: AuditTarget.SETTINGS,
		targetIdFromRequest: SETTINGS_TARGET,
		requestMetadata: {
			body: (request: TypedRequest<SetDrainingPolicyDto>) => ({
				mode: request.body?.mode,
				force: request.body?.force,
			}),
		},
		resultMetadata: SETTINGS_RESULT_METADATA,
	})
	async setDrainingPolicy(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Body() input: SetDrainingPolicyDto
	): Promise<SettingsDto> {
		return SettingsDto.from(
			await this.settings.set(
				{ drainingMode: input.mode, drainingForce: input.force },
				context.userId
			)
		);
	}
}
