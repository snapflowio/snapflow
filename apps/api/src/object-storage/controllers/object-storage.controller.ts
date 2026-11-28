/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { ThrottlerScope } from '../../common/decorators/throttler-scope.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import { RequiredAnyOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import {
	BuildContextUploadsDto,
	CreateBuildContextUploadsDto,
} from '../dto/build-context-upload.dto';
import { BuildContextUploadService } from '../services/build-context-upload.service';

@Controller('object-storage')
@ApiTags(OpenApiTag.OBJECT_STORAGE)
@ApiBearerAuth()
export class ObjectStorageController {
	constructor(
		private readonly buildContextUploads: BuildContextUploadService
	) {}

	@Post('build-context-uploads')
	@HttpCode(HttpStatus.OK)
	@ThrottlerScope(RateLimitThrottler.OBJECT_STORAGE_UPLOADS)
	@ApiOperation({
		summary: 'Prepare uploads of build context archives',
		description:
			'Reports which archives are already stored and returns a short-lived credential that can upload only the missing ones.',
		operationId: 'createBuildContextUploads',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Upload targets and a credential for the missing archives',
		type: BuildContextUploadsDto,
	})
	@RequiredAnyOrganizationPermissions({
		snapshots: ['write'],
		sandboxes: ['write'],
	})
	async createBuildContextUploads(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() request: CreateBuildContextUploadsDto
	): Promise<BuildContextUploadsDto> {
		return this.buildContextUploads.createUploads(
			authContext.organizationId,
			request.hashes
		);
	}
}
