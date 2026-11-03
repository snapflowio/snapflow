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
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	ParseEnumPipe,
	ParseIntPipe,
	ParseUUIDPipe,
	Post,
	Put,
	Res,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiHeader,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { OrganizationAccessService } from '../../../auth/services/organization-access.service';
import { CustomHeaders } from '../../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AccessDeniedException } from '../../../common/exceptions/access-denied.exception';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../../idempotency/request/services/api-idempotent-request.service';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import {
	SYSTEM_EXPOSURE_SERVICE,
	type SystemExposureService,
} from '../constants/exposure.constants';
import { NETWORKING_LIMITS } from '../constants/networking.constants';
import {
	CreateExposureDto,
	ExposureDto,
	RequestSystemExposureDto,
	UpdateExposureDto,
} from '../dto/exposure.dto';
import {
	CreateProtectedAccessGrantDto,
	ProtectedAccessGrantDto,
} from '../dto/protected-access.dto';
import { ExposureService } from '../services/exposure/exposure.service';
import { ExposureProvisioningService } from '../services/exposure/exposure-provisioning.service';
import { SystemExposureLeaseService } from '../services/exposure/system-exposure-lease.service';
import { ProtectedAccessGrantService } from '../services/protected-access/protected-access-grant.service';
import {
	SANDBOX_WRITE_PERMISSION,
	systemExposureRequiresSandboxWrite,
} from '../utils/exposure/system-exposure-access-policy.util';

@Controller('sandbox/:sandboxId/exposures')
@ApiTags('exposures')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class ExposureController {
	constructor(
		private readonly exposureService: ExposureService,
		private readonly exposureProvisioning: ExposureProvisioningService,
		private readonly protectedAccessGrants: ProtectedAccessGrantService,
		private readonly systemExposureLeases: SystemExposureLeaseService,
		private readonly idempotency: ApiIdempotentRequestService,
		private readonly organizationAccess: OrganizationAccessService
	) {}

	@Post('preview/:port')
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@ApiOperation({
		summary: 'Idempotently ensure the canonical HTTP preview exposure',
		operationId: 'ensurePreviewExposure',
	})
	@ApiParam({
		name: 'port',
		schema: {
			type: 'integer',
			minimum: NETWORKING_LIMITS.minimumPort,
			maximum: NETWORKING_LIMITS.maximumPort,
		},
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: ExposureDto })
	ensurePreviewExposure(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Param('port', ParseIntPipe) port: number
	): Promise<ExposureDto> {
		return this.exposureProvisioning.ensurePreview(
			authContext.organizationId,
			sandboxId,
			port
		);
	}

	@Post('system/:service/activate')
	@HttpCode(HttpStatus.OK)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Activate or renew a reserved system exposure lease',
		operationId: 'requestSystemExposure',
	})
	@ApiParam({
		name: 'service',
		enum: SYSTEM_EXPOSURE_SERVICE,
		enumName: 'SystemExposureService',
	})
	@ApiResponse({ status: HttpStatus.OK, type: ExposureDto })
	async requestSystemExposure(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Param('service', new ParseEnumPipe(SYSTEM_EXPOSURE_SERVICE))
		service: SystemExposureService,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() input: RequestSystemExposureDto,
		@Res({ passthrough: true }) response: Response
	): Promise<ExposureDto> {
		await this.assertSystemExposureAccess(authContext, service);
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: '/sandbox/:sandboxId/exposures/system/:service/activate',
				fingerprintInput: { sandboxId, service, ...input },
			},
			async (manager) => {
				const body = await this.systemExposureLeases.request(
					authContext.organizationId,
					sandboxId,
					service,
					input.durationSeconds,
					manager
				);
				return {
					body,
					status: HttpStatus.OK,
					resource: { type: 'exposure', id: body.id },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		}
		return result.body;
	}

	@Post(':exposureId/access-grants')
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Issue a short-lived single-use protected exposure grant',
		operationId: 'createProtectedAccessGrant',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: ProtectedAccessGrantDto })
	async createAccessGrant(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Param('exposureId', ParseUUIDPipe) exposureId: string,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() input: CreateProtectedAccessGrantDto,
		@Res({ passthrough: true }) response: Response
	): Promise<ProtectedAccessGrantDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate:
					'/sandbox/:sandboxId/exposures/:exposureId/access-grants',
				fingerprintInput: { sandboxId, exposureId, ...input },
			},
			async () => ({
				body: await this.protectedAccessGrants.issueWhenActive(
					authContext,
					sandboxId,
					exposureId,
					input,
					await this.canWriteSandboxes(authContext)
				),
				status: HttpStatus.CREATED,
				sensitive: true,
				resource: { type: 'protected_access_grant', id: exposureId },
			})
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		}
		return result.body;
	}

	private async assertSystemExposureAccess(
		authContext: OrganizationAuthContext,
		service: SystemExposureService
	): Promise<void> {
		if (
			systemExposureRequiresSandboxWrite(service) &&
			!(await this.canWriteSandboxes(authContext))
		) {
			throw new AccessDeniedException();
		}
	}

	private async canWriteSandboxes(
		authContext: OrganizationAuthContext
	): Promise<boolean> {
		const granted = await this.organizationAccess.grantedToContext(
			authContext,
			[SANDBOX_WRITE_PERMISSION]
		);
		return granted.length > 0;
	}

	@Delete(':exposureId/access-grants/:token')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Revoke an unredeemed protected exposure grant',
		operationId: 'revokeProtectedAccessGrant',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	revokeAccessGrant(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Param('exposureId', ParseUUIDPipe) exposureId: string,
		@Param('token') token: string
	): Promise<void> {
		return this.protectedAccessGrants.revoke(
			authContext.organizationId,
			sandboxId,
			exposureId,
			token
		);
	}

	@Post()
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@ApiOperation({
		summary: 'Create a canonical sandbox exposure',
		operationId: 'createSandboxExposure',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: ExposureDto })
	async create(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() input: CreateExposureDto,
		@Res({ passthrough: true }) response: Response
	): Promise<ExposureDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: '/sandbox/:sandboxId/exposures',
				fingerprintInput: { sandboxId, ...input },
			},
			async (manager) => {
				const body = await this.exposureProvisioning.create(
					authContext.organizationId,
					sandboxId,
					input,
					manager
				);
				return {
					body,
					status: HttpStatus.CREATED,
					resource: { type: 'exposure', id: body.id },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		}
		return result.body;
	}

	@Get()
	@ApiOperation({
		summary: 'List canonical sandbox exposures',
		operationId: 'listSandboxExposures',
	})
	@ApiResponse({ status: HttpStatus.OK, type: [ExposureDto] })
	findAll(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string
	): Promise<ExposureDto[]> {
		return this.exposureService.findAll(authContext.organizationId, sandboxId);
	}

	@Get(':exposureId')
	@ApiOperation({
		summary: 'Get a canonical sandbox exposure',
		operationId: 'getSandboxExposure',
	})
	@ApiResponse({ status: HttpStatus.OK, type: ExposureDto })
	findOne(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Param('exposureId', ParseUUIDPipe) exposureId: string
	): Promise<ExposureDto> {
		return this.exposureService.findOne(
			authContext.organizationId,
			sandboxId,
			exposureId
		);
	}

	@Put(':exposureId')
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@ApiOperation({
		summary: 'Replace mutable canonical sandbox exposure settings',
		operationId: 'updateSandboxExposure',
	})
	@ApiResponse({ status: HttpStatus.OK, type: ExposureDto })
	update(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Param('exposureId', ParseUUIDPipe) exposureId: string,
		@Body() input: UpdateExposureDto
	): Promise<ExposureDto> {
		return this.exposureService.update(
			authContext.organizationId,
			sandboxId,
			exposureId,
			input
		);
	}

	@Delete(':exposureId')
	@HttpCode(HttpStatus.ACCEPTED)
	@RequiredOrganizationPermissions({ sandboxes: ['delete'] })
	@ApiOperation({
		summary: 'Request deletion of a canonical sandbox exposure',
		operationId: 'deleteSandboxExposure',
	})
	@ApiResponse({ status: HttpStatus.ACCEPTED })
	remove(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Param('exposureId', ParseUUIDPipe) exposureId: string
	): Promise<void> {
		return this.exposureService.remove(
			authContext.organizationId,
			sandboxId,
			exposureId
		);
	}
}
