/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BadRequestException,
	Controller,
	DefaultValuePipe,
	Delete,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	ParseIntPipe,
	ParseUUIDPipe,
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
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Audit } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { CustomHeaders } from '../../common/constants/header.constants';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { apiError } from '../../common/utils/error/api-error.util';
import { ApiIdempotentRequestService } from '../../idempotency/services/api-idempotent-request.service';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import { SSH_ACCESS } from '../../sandbox/constants/ssh-access.constants';
import { SshAccessDto } from '../../sandbox/dto/ssh-access.dto';
import { SshAccessGrantDto } from '../../sandbox/dto/ssh-access-grant.dto';
import { SandboxAccessGuard } from '../../sandbox/guards/sandbox-access.guard';
import { SandboxService } from '../../sandbox/services/sandbox/sandbox.service';
import { NetworkingErrorCode } from '../enums/networking-error-code.enum';
import { SshRelayService } from '../services/ssh-relay.service';

@Controller('sandbox')
@ApiTags(OpenApiTag.SANDBOXES)
@ApiBearerAuth()
export class SshAccessController {
	constructor(
		private readonly sandboxes: SandboxService,
		private readonly relays: SshRelayService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Post(':sandboxIdOrName/ssh-access')
	@HttpCode(HttpStatus.OK)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Create SSH access through the canonical Edge relay',
		operationId: 'createSshAccess',
	})
	@ApiParam({ name: 'sandboxIdOrName', type: 'string' })
	@ApiQuery({
		name: 'expiresInMinutes',
		required: false,
		schema: {
			type: 'integer',
			minimum: SSH_ACCESS.minimumLifetimeMinutes,
			maximum: SSH_ACCESS.maximumLifetimeMinutes,
			default: SSH_ACCESS.defaultLifetimeMinutes,
		},
	})
	@ApiResponse({ status: HttpStatus.OK, type: SshAccessDto })
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.CREATE_SSH_ACCESS,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (request) => request.params.sandboxIdOrName,
		targetIdFromResult: (result: SshAccessDto) => result?.sandboxId,
		requestMetadata: {
			query: (request) => ({
				expiresInMinutes: request.query.expiresInMinutes,
			}),
		},
	})
	async create(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Query(
			'expiresInMinutes',
			new DefaultValuePipe(SSH_ACCESS.defaultLifetimeMinutes),
			new ParseIntPipe()
		)
		expiresInMinutes: number,
		@Res({ passthrough: true }) response: Response
	): Promise<SshAccessDto> {
		if (
			expiresInMinutes < SSH_ACCESS.minimumLifetimeMinutes ||
			expiresInMinutes > SSH_ACCESS.maximumLifetimeMinutes
		) {
			throw new BadRequestException(
				apiError(
					NetworkingErrorCode.ACCESS_LIFETIME_INVALID,
					'The SSH access lifetime is outside the supported range. Choose a shorter or longer lifetime within the documented limits.'
				)
			);
		}
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: '/sandbox/:sandboxIdOrName/ssh-access',
				fingerprintInput: { sandboxIdOrName, expiresInMinutes },
			},
			async (manager) => {
				const access = await this.sandboxes.createSshAccess(
					sandboxIdOrName,
					expiresInMinutes,
					authContext.organizationId,
					manager
				);
				return {
					body: access,
					status: HttpStatus.OK,
					sensitive: true,
					resource: { type: AuditTarget.SANDBOX, id: access.sandboxId },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		}
		const relay = await this.relays.waitForActive(result.body.token);
		return SshAccessDto.from(
			result.body,
			relay.host,
			relay.port,
			relay.machineHostPublicKey
		);
	}

	@Get(':sandboxIdOrName/ssh-access')
	@ApiOperation({
		summary: 'List active SSH access grants for a sandbox',
		operationId: 'listSshAccess',
	})
	@ApiParam({ name: 'sandboxIdOrName', type: 'string' })
	@ApiResponse({ status: HttpStatus.OK, type: [SshAccessGrantDto] })
	@UseGuards(SandboxAccessGuard)
	@RequiredAnyOrganizationPermissions({
		sandboxes: ['read', 'write', 'delete'],
	})
	async list(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string
	): Promise<SshAccessGrantDto[]> {
		const grants = await this.sandboxes.listActiveSshAccess(
			sandboxIdOrName,
			authContext.organizationId
		);
		return grants.map((grant) => SshAccessGrantDto.from(grant));
	}

	@Delete(':sandboxIdOrName/ssh-access/:accessId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Revoke one SSH access grant',
		operationId: 'revokeSshAccessGrant',
	})
	@ApiParam({ name: 'sandboxIdOrName', type: 'string' })
	@ApiParam({ name: 'accessId', type: 'string', format: 'uuid' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.REVOKE_SSH_ACCESS,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (request) => request.params.sandboxIdOrName,
		requestMetadata: {
			params: (request) => ({ accessId: request.params.accessId }),
		},
	})
	async revokeGrant(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Param('accessId', ParseUUIDPipe) accessId: string
	): Promise<void> {
		await this.sandboxes.revokeSshAccessGrant(
			sandboxIdOrName,
			accessId,
			authContext.organizationId
		);
	}
}
