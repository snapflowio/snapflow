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
import { CustomHeaders } from '../../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../../idempotency/request/services/api-idempotent-request.service';
import { RequiredSystemRole } from '../../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../../user/enums/system-role.enum';
import {
	AdminCreateDockerRegistryDto,
	AdminUpdateDockerRegistryDto,
} from '../dto/admin-docker-registry.dto';
import { DockerRegistryDto } from '../dto/docker-registry.dto';
import { DockerRegistryService } from '../services/docker-registry.service';

const REPLAYED = 'true';

const registryAuditBody = (
	request: TypedRequest<Partial<AdminCreateDockerRegistryDto>>
) => ({
	name: request.body?.name,
	url: request.body?.url,
});

@Controller('admin/docker-registry')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminDockerRegistryController {
	constructor(
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Get()
	@ApiOperation({
		summary: 'List the registries the platform owns',
		operationId: 'adminListPlatformRegistries',
	})
	@ApiResponse({ status: HttpStatus.OK, type: [DockerRegistryDto] })
	async list(): Promise<DockerRegistryDto[]> {
		return (await this.dockerRegistryService.findPlatformRegistries()).map(
			DockerRegistryDto.from
		);
	}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Create a platform registry that machines pull images with',
		operationId: 'adminCreatePlatformRegistry',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: DockerRegistryDto })
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.DOCKER_REGISTRY,
		targetIdFromResult: (result: DockerRegistryDto) => result?.id,
		requestMetadata: { body: registryAuditBody },
	})
	async create(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() input: AdminCreateDockerRegistryDto,
		@Res({ passthrough: true }) response: Response
	): Promise<DockerRegistryDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: context.organizationId,
				principal: context.principal,
				method: 'POST',
				routeTemplate: '/admin/docker-registry',
				fingerprintInput: input,
			},
			async (manager) => {
				const registry =
					await this.dockerRegistryService.createPlatformRegistry(
						input,
						manager
					);
				return {
					body: DockerRegistryDto.from(registry),
					status: HttpStatus.CREATED,
					resource: { type: AuditTarget.DOCKER_REGISTRY, id: registry.id },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, REPLAYED);
		}
		return result.body;
	}

	@Patch(':id')
	@ApiOperation({
		summary: 'Update a platform registry',
		operationId: 'adminUpdatePlatformRegistry',
	})
	@ApiParam({ name: 'id', description: 'ID of the docker registry' })
	@ApiResponse({ status: HttpStatus.OK, type: DockerRegistryDto })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.DOCKER_REGISTRY,
		targetIdFromRequest: (request) => request.params.id,
		requestMetadata: { body: registryAuditBody },
	})
	async update(
		@Param('id') registryId: string,
		@Body() input: AdminUpdateDockerRegistryDto
	): Promise<DockerRegistryDto> {
		await this.dockerRegistryService.assertPlatformRegistry(registryId);
		return DockerRegistryDto.from(
			await this.dockerRegistryService.update(registryId, input)
		);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Delete a platform registry',
		operationId: 'adminDeletePlatformRegistry',
	})
	@ApiParam({ name: 'id', description: 'ID of the docker registry' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.DOCKER_REGISTRY,
		targetIdFromRequest: (request) => request.params.id,
	})
	async delete(@Param('id') registryId: string): Promise<void> {
		await this.dockerRegistryService.assertPlatformRegistry(registryId);
		await this.dockerRegistryService.remove(registryId);
	}
}
