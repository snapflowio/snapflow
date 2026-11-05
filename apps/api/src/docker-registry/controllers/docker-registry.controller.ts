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
import {
	Audit,
	MASKED_AUDIT_VALUE,
	TypedRequest,
} from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { CustomHeaders } from '../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { CursorPageQueryDto } from '../../common/dto/cursor-page.dto';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../idempotency/services/api-idempotent-request.service';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import { CreateDockerRegistryDto } from '../dto/create-docker-registry.dto';
import {
	DockerRegistryDto,
	DockerRegistryPageDto,
} from '../dto/docker-registry.dto';
import { RegistryPushAccessDto } from '../dto/registry-push-access.dto';
import { UpdateDockerRegistryDto } from '../dto/update-docker-registry.dto';
import { DockerRegistryAccessGuard } from '../guards/docker-registry-access.guard';
import { RegistryType } from '../persistence/enums/registry-type.enum';
import { DockerRegistryService } from '../services/docker-registry.service';
import { RegistryPushAccessService } from '../services/registry-push-access.service';

@Controller('docker-registry')
@ApiTags('docker-registry')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class DockerRegistryController {
	constructor(
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly registryPushAccessService: RegistryPushAccessService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Post()
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Create registry',
		operationId: 'createRegistry',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The docker registry has been successfully created.',
		type: DockerRegistryDto,
	})
	@RequiredOrganizationPermissions({ registries: ['write'] })
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.DOCKER_REGISTRY,
		targetIdFromResult: (result: DockerRegistryDto) => result?.id,
		requestMetadata: {
			body: (req: TypedRequest<CreateDockerRegistryDto>) => ({
				name: req.body?.name,
				username: req.body?.username,
				password: req.body?.password ? MASKED_AUDIT_VALUE : undefined,
				url: req.body?.url,
				project: req.body?.project,
			}),
		},
	})
	async create(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() createDockerRegistryDto: CreateDockerRegistryDto,
		@Res({ passthrough: true }) response: Response
	): Promise<DockerRegistryDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: '/docker-registry',
				fingerprintInput: createDockerRegistryDto,
			},
			async (manager) => {
				const registry = await this.dockerRegistryService.create(
					{
						...createDockerRegistryDto,
						registryType: RegistryType.ORGANIZATION,
					},
					authContext.organizationId,
					manager
				);
				return {
					body: DockerRegistryDto.from(registry),
					status: HttpStatus.CREATED,
					resource: { type: 'docker_registry', id: registry.id },
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
		summary: 'List registries',
		operationId: 'listRegistries',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of all docker registries',
		type: DockerRegistryPageDto,
	})
	async findAll(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: CursorPageQueryDto
	): Promise<DockerRegistryPageDto> {
		const page = await this.dockerRegistryService.findPage(
			authContext.organizationId,
			RegistryType.ORGANIZATION,
			query.limit,
			query.cursor
		);
		return {
			...page,
			items: page.items.map(DockerRegistryDto.from),
		};
	}

	@Get('registry-push-access')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get temporary registry access for pushing snapshots',
		operationId: 'getTransientPushAccess',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Temporary registry access has been generated',
		type: RegistryPushAccessDto,
	})
	@RequiredAnyOrganizationPermissions({
		snapshots: ['write'],
		sandboxes: ['write'],
	})
	@AllowAuthMethods([AuthMethod.SESSION])
	async getTransientPushAccess(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<RegistryPushAccessDto> {
		return this.registryPushAccessService.getPushAccess(
			authContext.organizationId,
			authContext.userId
		);
	}

	@Get(':id')
	@ApiOperation({
		summary: 'Get registry',
		operationId: 'getRegistry',
	})
	@ApiParam({
		name: 'id',
		description: 'ID of the docker registry',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The docker registry',
		type: DockerRegistryDto,
	})
	@UseGuards(DockerRegistryAccessGuard)
	async findOne(@Param('id') registryId: string): Promise<DockerRegistryDto> {
		return DockerRegistryDto.from(
			await this.dockerRegistryService.findOneOrFail(registryId)
		);
	}

	@Patch(':id')
	@ApiOperation({
		summary: 'Update registry',
		operationId: 'updateRegistry',
	})
	@ApiParam({
		name: 'id',
		description: 'ID of the docker registry',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The docker registry has been successfully updated.',
		type: DockerRegistryDto,
	})
	@UseGuards(DockerRegistryAccessGuard)
	@RequiredOrganizationPermissions({ registries: ['write'] })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.DOCKER_REGISTRY,
		targetIdFromRequest: (req) => req.params.id,
		requestMetadata: {
			body: (req: TypedRequest<UpdateDockerRegistryDto>) => ({
				name: req.body?.name,
				url: req.body?.url,
				username: req.body?.username,
				password: req.body?.password ? MASKED_AUDIT_VALUE : undefined,
				project: req.body?.project,
			}),
		},
	})
	async update(
		@Param('id') registryId: string,
		@Body() updateDockerRegistryDto: UpdateDockerRegistryDto
	): Promise<DockerRegistryDto> {
		const dockerRegistry = await this.dockerRegistryService.update(
			registryId,
			updateDockerRegistryDto
		);
		return DockerRegistryDto.from(dockerRegistry);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Delete registry',
		operationId: 'deleteRegistry',
	})
	@ApiParam({
		name: 'id',
		description: 'ID of the docker registry',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The docker registry has been successfully deleted.',
	})
	@UseGuards(DockerRegistryAccessGuard)
	@RequiredOrganizationPermissions({ registries: ['delete'] })
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.DOCKER_REGISTRY,
		targetIdFromRequest: (req) => req.params.id,
	})
	async remove(@Param('id') registryId: string): Promise<void> {
		return this.dockerRegistryService.remove(registryId);
	}
}
