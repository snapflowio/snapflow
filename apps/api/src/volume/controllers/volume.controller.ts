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
	Patch,
	Post,
	Query,
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
import { Audit, TypedRequest } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { CustomHeaders } from '../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../idempotency/services/api-idempotent-request.service';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { CreateVolumeDto } from '../dto/create-volume.dto';
import { ResizeVolumeDto } from '../dto/resize-volume.dto';
import {
	ListVolumesQueryDto,
	VolumeDto,
	VolumePageDto,
} from '../dto/volume.dto';
import { VolumeAccessGuard } from '../guards/volume-access.guard';
import { VolumeService } from '../services/volume.service';
import { VolumeOperationService } from '../services/volume-operation.service';
import { VolumeProvisioningService } from '../services/volume-provisioning.service';

@Controller('volumes')
@ApiTags('volumes')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class VolumeController {
	constructor(
		private readonly volumeService: VolumeService,
		private readonly volumeProvisioning: VolumeProvisioningService,
		private readonly volumeOperations: VolumeOperationService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Get()
	@ApiOperation({
		summary: 'List all volumes',
		operationId: 'listVolumes',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Page of volumes',
		type: VolumePageDto,
	})
	@RequiredOrganizationPermissions({ volumes: ['read'] })
	async listVolumes(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListVolumesQueryDto
	): Promise<VolumePageDto> {
		const page = await this.volumeService.findAll(
			authContext.organizationId,
			query.includeDeleted,
			query.limit,
			query.cursor
		);
		return { ...page, items: page.items.map(VolumeDto.from) };
	}

	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Create a new volume',
		operationId: 'createVolume',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The volume has been successfully created.',
		type: VolumeDto,
	})
	@RequiredOrganizationPermissions({ volumes: ['write'] })
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.VOLUME,
		targetIdFromResult: (result: VolumeDto) => result?.id,
		requestMetadata: {
			body: (req: TypedRequest<CreateVolumeDto>) => ({
				name: req.body?.name,
			}),
		},
	})
	async createVolume(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() createVolumeDto: CreateVolumeDto,
		@Res({ passthrough: true }) response: Response
	): Promise<VolumeDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: '/volumes',
				fingerprintInput: createVolumeDto,
			},
			async (manager) => {
				const volume = await this.volumeProvisioning.create(
					authContext.organizationId,
					createVolumeDto,
					manager
				);
				return {
					body: VolumeDto.from(volume),
					status: HttpStatus.OK,
					resource: { type: 'volume', id: volume.id },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		}
		return result.body;
	}

	@Get(':volumeId')
	@ApiOperation({
		summary: 'Get volume details',
		operationId: 'getVolume',
	})
	@ApiParam({
		name: 'volumeId',
		description: 'ID of the volume',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Volume details',
		type: VolumeDto,
	})
	@UseGuards(VolumeAccessGuard)
	@RequiredOrganizationPermissions({ volumes: ['read'] })
	async getVolume(@Param('volumeId') volumeId: string): Promise<VolumeDto> {
		const volume = await this.volumeService.findOne(volumeId);
		return VolumeDto.from(volume);
	}

	@Patch(':volumeId')
	@ApiOperation({
		summary: 'Grow a detached persistent volume',
		operationId: 'resizeVolume',
	})
	@ApiResponse({ status: HttpStatus.OK, type: VolumeDto })
	@UseGuards(VolumeAccessGuard)
	@RequiredOrganizationPermissions({ volumes: ['write'] })
	async resizeVolume(
		@Param('volumeId') volumeId: string,
		@Body() request: ResizeVolumeDto
	): Promise<VolumeDto> {
		return VolumeDto.from(
			await this.volumeOperations.resize(volumeId, request.targetSizeGiB)
		);
	}

	@Post(':volumeId/restore')
	@HttpCode(HttpStatus.OK)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Restore a detached volume from its latest portable backup',
		operationId: 'restoreVolume',
	})
	@ApiResponse({ status: HttpStatus.OK, type: VolumeDto })
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description: 'The volume is attached or has no completed portable backup',
	})
	@UseGuards(VolumeAccessGuard)
	@RequiredOrganizationPermissions({ volumes: ['write'] })
	@Audit({
		action: AuditAction.RECOVER,
		targetType: AuditTarget.VOLUME,
		targetIdFromRequest: (req) => req.params.volumeId,
	})
	async restoreVolume(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('volumeId') volumeId: string,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Res({ passthrough: true }) response: Response
	): Promise<VolumeDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: '/volumes/:volumeId/restore',
				fingerprintInput: { volumeId },
			},
			async (manager) => ({
				body: VolumeDto.from(
					await this.volumeOperations.restore(volumeId, manager)
				),
				status: HttpStatus.OK,
				resource: { type: AuditTarget.VOLUME, id: volumeId },
			})
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		}
		return result.body;
	}

	@Delete(':volumeId')
	@ApiOperation({
		summary: 'Delete volume',
		operationId: 'deleteVolume',
	})
	@ApiParam({
		name: 'volumeId',
		description: 'ID of the volume',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Volume has been marked for deletion',
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description: 'Volume is in use by one or more sandboxes',
	})
	@UseGuards(VolumeAccessGuard)
	@RequiredOrganizationPermissions({ volumes: ['delete'] })
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.VOLUME,
		targetIdFromRequest: (req) => req.params.volumeId,
	})
	async deleteVolume(@Param('volumeId') volumeId: string): Promise<void> {
		return this.volumeProvisioning.delete(volumeId);
	}

	@Get('by-name/:name')
	@ApiOperation({
		summary: 'Get volume details by name',
		operationId: 'getVolumeByName',
	})
	@ApiParam({
		name: 'name',
		description: 'Name of the volume',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Volume details',
		type: VolumeDto,
	})
	@UseGuards(VolumeAccessGuard)
	@RequiredOrganizationPermissions({ volumes: ['read'] })
	async getVolumeByName(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('name') name: string
	): Promise<VolumeDto> {
		const volume = await this.volumeService.findByName(
			authContext.organizationId,
			name
		);
		return VolumeDto.from(volume);
	}
}
