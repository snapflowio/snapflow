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
	HttpCode,
	HttpStatus,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredAnyOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { StorageAccessDto } from '../dto/storage-access.dto';
import { ObjectStoragePushAccessService } from '../services/object-storage-push-access.service';

@Controller('object-storage')
@ApiTags('object-storage')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class ObjectStorageController {
	constructor(private readonly pushAccess: ObjectStoragePushAccessService) {}

	@Get('push-access')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get temporary storage access for pushing objects',
		operationId: 'getPushAccess',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Temporary storage access has been generated',
		type: StorageAccessDto,
	})
	@RequiredAnyOrganizationPermissions({
		snapshots: ['write'],
		sandboxes: ['write'],
	})
	async getPushAccess(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<StorageAccessDto> {
		return this.pushAccess.getPushAccess(authContext.organizationId);
	}
}
