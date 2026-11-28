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
	Post,
	Put,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
	Audit,
	type TypedRequest,
} from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import {
	isOrganizationAuthContext,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { AcceptLegalDocumentDto } from '../../legal/dto/accept-legal-document.dto';
import { assertAcceptedBySelf } from '../../legal/utils/legal-version.util';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { MARKETPLACE_ROUTE } from '../constants/marketplace.constants';
import { HostProfileDto, UpdateHostProfileDto } from '../dto/host-profile.dto';
import { HostProfileService } from '../services/host-profile.service';

const activeOrganizationId = (request: Request): string | null =>
	isOrganizationAuthContext(request.user) ? request.user.organizationId : null;

@Controller(MARKETPLACE_ROUTE.HOST_PROFILE)
@ApiTags(OpenApiTag.HOST_PROFILE)
@ApiBearerAuth()
export class HostProfileController {
	constructor(private readonly profiles: HostProfileService) {}

	@Get()
	@ApiOperation({
		summary:
			"Get the organization's host profile and the stats its listings show",
		operationId: 'getHostProfile',
	})
	@ApiResponse({ status: HttpStatus.OK, type: HostProfileDto })
	@RequiredOrganizationPermissions({ listings: ['read'] })
	get(
		@IsOrganizationAuthContext() context: OrganizationAuthContext
	): Promise<HostProfileDto> {
		return this.profiles.get(context.organizationId);
	}

	@Put()
	@ApiOperation({
		summary: 'Set the name and description listings show for the host',
		operationId: 'updateHostProfile',
	})
	@ApiResponse({ status: HttpStatus.OK, type: HostProfileDto })
	@RequiredOrganizationPermissions({ listings: ['write'] })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.ORGANIZATION,
		targetIdFromRequest: activeOrganizationId,
		requestMetadata: {
			body: (request: TypedRequest<UpdateHostProfileDto>) => ({
				displayName: request.body?.displayName,
				description: request.body?.description,
			}),
		},
	})
	update(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Body() input: UpdateHostProfileDto
	): Promise<HostProfileDto> {
		return this.profiles.update(context.organizationId, input);
	}

	@Post('terms-acceptance')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Accept the current host terms for the organization',
		operationId: 'acceptHostTerms',
	})
	@ApiResponse({ status: HttpStatus.OK, type: HostProfileDto })
	@RequiredOrganizationPermissions({ listings: ['write'] })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.ORGANIZATION,
		targetIdFromRequest: activeOrganizationId,
		requestMetadata: {
			body: (request: TypedRequest<AcceptLegalDocumentDto>) => ({
				hostTermsVersion: request.body?.version,
			}),
		},
	})
	acceptHostTerms(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Body() input: AcceptLegalDocumentDto
	): Promise<HostProfileDto> {
		assertAcceptedBySelf(context.credential);
		return this.profiles.acceptHostTerms(
			context.organizationId,
			context.userId,
			input.version
		);
	}
}
