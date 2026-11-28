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
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
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
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import {
	ApiKeyBudgetDto,
	UpdateApiKeyBudgetDto,
} from '../dto/api-key-budget.dto';
import { ApiKeyBudgetService } from '../services/api-key-budget.service';

@Controller('api-keys/:apiKeyId/budget')
@ApiTags(OpenApiTag.API_KEYS)
@ApiBearerAuth()
export class ApiKeyBudgetController {
	constructor(private readonly budgets: ApiKeyBudgetService) {}

	@Get()
	@ApiOperation({
		summary:
			"Get an API key's budget and what the sandboxes it created spent and run",
		operationId: 'getApiKeyBudget',
	})
	@ApiResponse({ status: HttpStatus.OK, type: ApiKeyBudgetDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	get(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('apiKeyId', ParseUUIDPipe) apiKeyId: string
	): Promise<ApiKeyBudgetDto> {
		return this.budgets.get(authContext.organizationId, apiKeyId);
	}

	@Put()
	@ApiOperation({
		summary:
			"Set an API key's budget: a key at its budget gets 402 on new starts, and at its spending limit its sandboxes stop",
		operationId: 'updateApiKeyBudget',
	})
	@ApiResponse({ status: HttpStatus.OK, type: ApiKeyBudgetDto })
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	@Audit({ action: AuditAction.UPDATE, targetType: AuditTarget.API_KEY })
	@AllowAuthMethods([AuthMethod.SESSION])
	update(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('apiKeyId', ParseUUIDPipe) apiKeyId: string,
		@Body() input: UpdateApiKeyBudgetDto
	): Promise<ApiKeyBudgetDto> {
		return this.budgets.update(authContext.organizationId, apiKeyId, input);
	}
}
