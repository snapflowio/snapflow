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
	Headers,
	HttpCode,
	HttpStatus,
	Param,
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
	TypedRequest,
} from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import { CustomHeaders } from '../../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../../idempotency/request/services/api-idempotent-request.service';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import { CreateSandboxSnapshotDto } from '../../snapshot/dto/create-sandbox-snapshot.dto';
import { SandboxDto } from '../dto/sandbox.dto';
import { SandboxAccessGuard } from '../guards/sandbox-access.guard';
import { SandboxCaptureService } from '../services/lifecycle/sandbox-capture.service';

@Controller('sandbox')
@ApiTags('sandbox')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class SandboxCaptureController {
	constructor(
		private readonly capture: SandboxCaptureService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Post(':sandboxIdOrName/backup')
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Create sandbox backup',
		operationId: 'createBackup',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Sandbox backup has been initiated',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.CREATE_BACKUP,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
	})
	async createBackup(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Res({ passthrough: true }) response: Response
	): Promise<SandboxDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: '/sandbox/:sandboxIdOrName/backup',
				fingerprintInput: { sandboxIdOrName },
			},
			async () => {
				const sandbox = await this.capture.createBackup(
					sandboxIdOrName,
					authContext.organizationId
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

	@Post(':sandboxIdOrName/snapshot')
	@HttpCode(HttpStatus.OK)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Create a snapshot from a sandbox',
		operationId: 'createSandboxSnapshot',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Snapshot creation has been initiated',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.SNAPSHOT,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxIdOrName,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			body: (req: TypedRequest<CreateSandboxSnapshotDto>) => ({
				name: req.body?.name,
			}),
		},
	})
	async createSandboxSnapshot(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() dto: CreateSandboxSnapshotDto,
		@Res({ passthrough: true }) response: Response
	): Promise<SandboxDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: '/sandbox/:sandboxIdOrName/snapshot',
				fingerprintInput: { sandboxIdOrName, ...dto },
			},
			async () => {
				const sandbox = await this.capture.createSnapshotFromSandbox(
					sandboxIdOrName,
					authContext.organizationId,
					dto
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
}
