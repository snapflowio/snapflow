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
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	ParseIntPipe,
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
import { Audit } from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import { CustomHeaders } from '../../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../../idempotency/request/services/api-idempotent-request.service';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import { SSH_ACCESS } from '../../../sandbox/instance/constants/ssh-access.constants';
import { SshAccessDto } from '../../../sandbox/instance/dto/ssh-access.dto';
import { SandboxAccessGuard } from '../../../sandbox/instance/guards/sandbox-access.guard';
import { SandboxService } from '../../../sandbox/instance/services/sandbox/sandbox.service';
import { SshRelayService } from '../services/ssh-relay.service';

@Controller('sandbox')
@ApiTags('sandbox')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
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
				'SSH access lifetime is outside the supported range'
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
}
