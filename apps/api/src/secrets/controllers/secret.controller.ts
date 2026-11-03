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
	ParseIntPipe,
	Patch,
	Post,
	Query,
	Res,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiHeader,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
	Audit,
	MASKED_AUDIT_VALUE,
	TypedRequest,
} from '../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../audit/log/enums/audit-target.enum';
import { CustomHeaders } from '../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { CursorPageQueryDto } from '../../common/dto/cursor-page.dto';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../idempotency/request/services/api-idempotent-request.service';
import { parseRequiredResourceVersion } from '../../infra/database/utils/resource-version.util';
import { RequiredOrganizationPermissions } from '../../organization/tenant/decorators/required-organization-permissions.decorator';
import {
	CreateSecretDto,
	CreateSecretVersionDto,
	ReplaceSandboxSecretBindingsDto,
	SandboxSecretBindingSetDto,
	SecretDto,
	SecretPageDto,
	SecretVersionDto,
	SecretVersionPageDto,
	UpdateSecretDto,
} from '../dto/secret.dto';
import { SecretService } from '../services/secret.service';
import { SecretResourceService } from '../services/secret-resource.service';

@Controller('secrets')
@ApiTags('secrets')
@ApiBearerAuth()
export class SecretController {
	constructor(
		private readonly secrets: SecretResourceService,
		private readonly sandboxBindings: SecretService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Get()
	@ApiOperation({ operationId: 'listSecrets', summary: 'List secret metadata' })
	@ApiResponse({ status: HttpStatus.OK, type: SecretPageDto })
	@RequiredOrganizationPermissions({ secrets: ['read'] })
	list(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Query() query: CursorPageQueryDto
	): Promise<SecretPageDto> {
		return this.secrets.list(context.organizationId, query.limit, query.cursor);
	}

	@Get(':secretId')
	@ApiOperation({ operationId: 'getSecret', summary: 'Get secret metadata' })
	@ApiResponse({ status: HttpStatus.OK, type: SecretDto })
	@RequiredOrganizationPermissions({ secrets: ['read'] })
	async get(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('secretId') secretId: string
	): Promise<SecretDto> {
		return SecretDto.from(
			await this.secrets.findOne(context.organizationId, secretId)
		);
	}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		operationId: 'createSecret',
		summary: 'Create a secret and its first immutable version',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: SecretDto })
	@RequiredOrganizationPermissions({ secrets: ['write'] })
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.SECRET,
		targetIdFromResult: (result: SecretDto) => result.id,
		requestMetadata: {
			body: (request: TypedRequest<CreateSecretDto>) => ({
				name: request.body.name,
				value: MASKED_AUDIT_VALUE,
			}),
		},
	})
	async create(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() input: CreateSecretDto,
		@Res({ passthrough: true }) response: Response
	): Promise<SecretDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: context.organizationId,
				principal: context.principal,
				method: 'POST',
				routeTemplate: '/secrets',
				fingerprintInput: input,
			},
			async (manager) => {
				const secret = await this.secrets.create(
					context.organizationId,
					context.principal,
					input,
					manager
				);
				return {
					body: SecretDto.from(secret),
					status: HttpStatus.CREATED,
					resource: { type: AuditTarget.SECRET, id: secret.id },
				};
			}
		);
		this.markReplay(response, result.replayed);
		return result.body;
	}

	@Patch(':secretId')
	@ApiOperation({
		operationId: 'updateSecret',
		summary: 'Update secret metadata',
	})
	@RequiredOrganizationPermissions({ secrets: ['write'] })
	async update(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('secretId') secretId: string,
		@Headers('if-match') ifMatch: string | undefined,
		@Body() input: UpdateSecretDto
	): Promise<SecretDto> {
		const secret = await this.secrets.update(
			context.organizationId,
			secretId,
			parseRequiredResourceVersion(ifMatch),
			input
		);
		return SecretDto.from(secret);
	}

	@Get(':secretId/versions')
	@ApiOperation({
		operationId: 'listSecretVersions',
		summary: 'List immutable secret versions',
	})
	@RequiredOrganizationPermissions({ secrets: ['read'] })
	listVersions(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('secretId') secretId: string,
		@Query() query: CursorPageQueryDto
	): Promise<SecretVersionPageDto> {
		return this.secrets.listVersions(
			context.organizationId,
			secretId,
			query.limit,
			query.cursor
		);
	}

	@Post(':secretId/versions')
	@HttpCode(HttpStatus.CREATED)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		operationId: 'createSecretVersion',
		summary: 'Create a new immutable secret version',
	})
	@RequiredOrganizationPermissions({ secrets: ['write'] })
	async createVersion(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('secretId') secretId: string,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() input: CreateSecretVersionDto,
		@Res({ passthrough: true }) response: Response
	): Promise<SecretVersionDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: context.organizationId,
				principal: context.principal,
				method: 'POST',
				routeTemplate: '/secrets/:secretId/versions',
				fingerprintInput: { secretId, ...input },
			},
			async (manager) => ({
				body: SecretVersionDto.from(
					await this.secrets.createVersion(
						context.organizationId,
						secretId,
						context.principal,
						input,
						manager
					)
				),
				status: HttpStatus.CREATED,
			})
		);
		this.markReplay(response, result.replayed);
		return result.body;
	}

	@Post(':secretId/versions/:version/revoke')
	@ApiOperation({
		operationId: 'revokeSecretVersion',
		summary: 'Revoke a non-current secret version',
	})
	@RequiredOrganizationPermissions({ secrets: ['write'] })
	async revokeVersion(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('secretId') secretId: string,
		@Param('version', ParseIntPipe) version: number,
		@Headers('if-match') ifMatch: string | undefined
	): Promise<SecretVersionDto> {
		const revoked = await this.secrets.revokeVersion(
			context.organizationId,
			secretId,
			version,
			parseRequiredResourceVersion(ifMatch)
		);
		return SecretVersionDto.from(revoked);
	}

	@Get('sandbox/:sandboxId/bindings')
	@ApiOperation({
		operationId: 'getSandboxSecretBindings',
		summary: 'Get pinned sandbox secret binding metadata',
	})
	@RequiredOrganizationPermissions({ secrets: ['read'] })
	getSandboxBindings(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string
	): Promise<SandboxSecretBindingSetDto> {
		return this.sandboxBindings.getSandboxBindings(
			context.organizationId,
			sandboxId
		);
	}

	@Post('sandbox/:sandboxId/bindings')
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		operationId: 'replaceSandboxSecretBindings',
		summary: 'Replace pinned bindings for a stopped sandbox',
	})
	@RequiredOrganizationPermissions({ secrets: ['write'] })
	async replaceSandboxBindings(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('sandboxId') sandboxId: string,
		@Headers('if-match') ifMatch: string | undefined,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() input: ReplaceSandboxSecretBindingsDto,
		@Res({ passthrough: true }) response: Response
	): Promise<SandboxSecretBindingSetDto> {
		const expectedVersion = parseRequiredResourceVersion(ifMatch);
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: context.organizationId,
				principal: context.principal,
				method: 'POST',
				routeTemplate: '/secrets/sandbox/:sandboxId/bindings',
				fingerprintInput: { sandboxId, expectedVersion, ...input },
			},
			async (manager) => ({
				body: await this.sandboxBindings.replaceSandboxBindings(
					manager,
					context.organizationId,
					sandboxId,
					expectedVersion,
					input,
					context.principal
				),
				status: HttpStatus.OK,
			})
		);
		this.markReplay(response, result.replayed);
		return result.body;
	}

	@Delete(':secretId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		operationId: 'deleteSecret',
		summary: 'Delete an unreferenced secret',
	})
	@RequiredOrganizationPermissions({ secrets: ['delete'] })
	delete(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('secretId') secretId: string,
		@Headers('if-match') ifMatch: string | undefined
	): Promise<void> {
		return this.secrets.delete(
			context.organizationId,
			secretId,
			parseRequiredResourceVersion(ifMatch)
		);
	}

	private markReplay(response: Response, replayed: boolean): void {
		if (replayed)
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
	}
}
