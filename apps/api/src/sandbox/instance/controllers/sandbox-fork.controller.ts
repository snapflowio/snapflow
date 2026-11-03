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
	Headers,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
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
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
	Audit,
	TypedRequest,
} from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import { OrganizationAccessService } from '../../../auth/services/organization-access.service';
import { CustomHeaders } from '../../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { ThrottlerScope } from '../../../common/decorators/throttler-scope.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../../idempotency/request/services/api-idempotent-request.service';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import { ForkSandboxDto } from '../dto/fork-sandbox.dto';
import {
	ListSandboxForksQueryDto,
	SandboxPageDto,
} from '../dto/list-sandbox-forks.dto';
import { SandboxDto } from '../dto/sandbox.dto';
import { SandboxAccessGuard } from '../guards/sandbox-access.guard';
import { SandboxForkService } from '../services/lifecycle/sandbox-fork.service';
import { canUseManagedSecrets } from '../utils/runtime/managed-secrets-permission.util';

@Controller('sandbox')
@ApiTags('sandbox')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class SandboxForkController {
	constructor(
		private readonly forks: SandboxForkService,
		private readonly idempotency: ApiIdempotentRequestService,
		private readonly organizationAccess: OrganizationAccessService
	) {}

	@Post(':sandboxIdOrName/fork')
	@HttpCode(HttpStatus.OK)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('sandbox-create')
	@ApiOperation({
		summary: 'Fork a sandbox',
		operationId: 'forkSandbox',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Fork operation has been initiated',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.FORK,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			body: (req: TypedRequest<ForkSandboxDto>) => ({
				name: req.body?.name,
			}),
		},
	})
	async forkSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() dto: ForkSandboxDto,
		@Res({ passthrough: true }) response: Response
	): Promise<SandboxDto> {
		const managedSecretsAllowed = await canUseManagedSecrets(
			this.organizationAccess,
			authContext
		);
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: '/sandbox/:sandboxIdOrName/fork',
				fingerprintInput: { sandboxIdOrName, ...dto },
			},
			async () => {
				const sandbox = await this.forks.forkSandbox(
					sandboxIdOrName,
					authContext.organizationId,
					dto,
					authContext.principal,
					managedSecretsAllowed
				);
				return {
					body: SandboxDto.from(sandbox),
					status: HttpStatus.OK,
					resource: { type: AuditTarget.SANDBOX, id: sandbox.id },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		}
		return result.body;
	}

	@Get(':sandboxIdOrName/forks')
	@ApiOperation({
		summary: 'Get sandbox fork children',
		operationId: 'getSandboxForks',
	})
	@ApiParam({ name: 'sandboxIdOrName', type: String })
	@ApiResponse({ status: HttpStatus.OK, type: SandboxPageDto })
	@UseGuards(SandboxAccessGuard)
	async getSandboxForks(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Query() query: ListSandboxForksQueryDto
	): Promise<SandboxPageDto> {
		const page = await this.forks.getForkChildren(
			authContext.organizationId,
			sandboxIdOrName,
			query.includeDestroyed,
			query.limit,
			query.cursor
		);
		return {
			...page,
			items: page.items.map((sandbox) => SandboxDto.from(sandbox)),
		};
	}

	@Get(':sandboxIdOrName/parent')
	@ApiOperation({
		summary: 'Get sandbox fork parent',
		operationId: 'getSandboxParent',
	})
	@ApiParam({ name: 'sandboxIdOrName', type: String })
	@ApiResponse({ status: HttpStatus.OK, type: SandboxDto })
	@UseGuards(SandboxAccessGuard)
	async getSandboxParent(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string
	): Promise<SandboxDto> {
		const parent = await this.forks.getForkParent(
			authContext.organizationId,
			sandboxIdOrName
		);
		if (!parent) {
			throw new NotFoundException(
				`Parent sandbox not found for sandbox ${sandboxIdOrName}`
			);
		}
		return SandboxDto.from(parent);
	}

	@Get(':sandboxIdOrName/ancestors')
	@ApiOperation({
		summary: 'Get sandbox fork ancestor chain',
		operationId: 'getSandboxAncestors',
	})
	@ApiParam({ name: 'sandboxIdOrName', type: String })
	@ApiResponse({ status: HttpStatus.OK, type: [SandboxDto] })
	@UseGuards(SandboxAccessGuard)
	async getSandboxAncestors(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string
	): Promise<SandboxDto[]> {
		const ancestors = await this.forks.getForkAncestors(
			authContext.organizationId,
			sandboxIdOrName
		);
		return ancestors.map((sandbox) => SandboxDto.from(sandbox));
	}
}
