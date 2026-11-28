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
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	Req,
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
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
	Audit,
	MASKED_AUDIT_VALUE,
	TypedRequest,
} from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { OrganizationAccessService } from '../../auth/services/organization-access.service';
import { CustomHeaders } from '../../common/constants/header.constants';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { ThrottlerScope } from '../../common/decorators/throttler-scope.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { apiError } from '../../common/utils/error/api-error.util';
import { ApiIdempotentRequestService } from '../../idempotency/services/api-idempotent-request.service';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import { ApiPaymentRequiredResponse } from '../decorators/api-payment-required-response.decorator';
import { ApiPlacementConflictResponse } from '../decorators/api-placement-conflict-response.decorator';
import { CreateSandboxDto } from '../dto/create-sandbox.dto';
import { ListSandboxesQueryDto } from '../dto/list-sandboxes-query.dto';
import { ListSandboxesResponseDto } from '../dto/list-sandboxes-response.dto';
import { SandboxDto } from '../dto/sandbox.dto';
import {
	MachineUnavailableErrorDto,
	PriceChangedErrorDto,
} from '../dto/sandbox-placement-error.dto';
import {
	SandboxQuoteDto,
	SandboxQuoteRequestDto,
} from '../dto/sandbox-quote.dto';
import { AwaitSandboxStateChangeQueryDto } from '../dto/sandbox-state-change.dto';
import { SandboxErrorCode } from '../enums/sandbox-error-code.enum';
import { SandboxAccessGuard } from '../guards/sandbox-access.guard';
import { SandboxApiKeyBudgetService } from '../services/admission/sandbox-api-key-budget.service';
import { SandboxQuoteService } from '../services/admission/sandbox-quote.service';
import { SandboxBuildCreateService } from '../services/lifecycle/sandbox-build-create.service';
import { SandboxSnapshotCreateService } from '../services/lifecycle/sandbox-snapshot-create.service';
import { SandboxService } from '../services/sandbox/sandbox.service';
import { SandboxSearchService } from '../services/sandbox/sandbox-search.service';
import { SandboxStateWaitService } from '../services/state/sandbox-state-wait.service';
import { canUseManagedSecrets } from '../utils/runtime/managed-secrets-permission.util';
import { attributeToApiKey } from '../utils/sandbox-api-key.util';

@Controller('sandbox')
@ApiTags(OpenApiTag.SANDBOXES)
@ApiBearerAuth()
@ApiErrorResponse()
export class SandboxController {
	constructor(
		private readonly sandboxService: SandboxService,
		private readonly quotes: SandboxQuoteService,
		private readonly search: SandboxSearchService,
		private readonly snapshotCreates: SandboxSnapshotCreateService,
		private readonly buildCreates: SandboxBuildCreateService,
		private readonly idempotency: ApiIdempotentRequestService,
		private readonly organizationAccess: OrganizationAccessService,
		private readonly stateWaits: SandboxStateWaitService,
		private readonly apiKeyBudgets: SandboxApiKeyBudgetService
	) {}

	@Post('quotes')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Quote a sandbox against current eligible machine offers',
		description:
			'The quote is an expiring estimate and does not reserve a machine. The placement authorization records the accepted immutable rate.',
		operationId: 'quoteSandbox',
	})
	@ApiResponse({ status: HttpStatus.OK, type: SandboxQuoteDto })
	@RequiredAnyOrganizationPermissions({
		sandboxes: ['read', 'write', 'delete'],
	})
	quoteSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() request: SandboxQuoteRequestDto,
		@Req() httpRequest: Request
	): Promise<SandboxQuoteDto> {
		return this.quotes.quote(
			request,
			authContext.organizationId,
			httpRequest.ip
		);
	}

	@Get()
	@ApiOperation({
		summary: 'List sandboxes',
		description:
			'Lists the sandboxes of the organization with filtering and ordering. Results are eventually consistent, so a sandbox created a moment ago may appear shortly after.',
		operationId: 'listSandboxes',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: ListSandboxesResponseDto,
	})
	@RequiredAnyOrganizationPermissions({
		sandboxes: ['read', 'write', 'delete'],
	})
	async listSandboxes(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListSandboxesQueryDto
	): Promise<ListSandboxesResponseDto> {
		return this.search.search(authContext.organizationId, query);
	}

	@Post()
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@SkipThrottle({ authenticated: true })
	@ThrottlerScope('sandbox-create')
	@ApiOperation({
		summary: 'Create a new sandbox',
		description:
			'Accepts the sandbox and returns it immediately, usually before it has started. Call awaitSandboxStateChange or getSandbox until its state is started. Errors carry a stable code: sandbox_quota_exceeded or sandbox_resource_limit_exceeded when a limit is hit, snapshot_disk_too_small when the requested disk cannot hold the snapshot, gpu_type_not_allowed when the organization may not use the GPU type, no_available_machine or machine_unavailable when no listing can take it, and insufficient_credit when the escrow balance is too low.',
		operationId: 'createSandbox',
	})
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Sandbox creation was durably accepted.',
		type: SandboxDto,
	})
	@ApiPlacementConflictResponse(
		MachineUnavailableErrorDto,
		PriceChangedErrorDto
	)
	@ApiPaymentRequiredResponse()
	@RequiredOrganizationPermissions({ sandboxes: ['write'] })
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.SANDBOX,
		targetIdFromResult: (result: SandboxDto) => result?.id,
		requestMetadata: {
			body: (req: TypedRequest<CreateSandboxDto>) => ({
				name: req.body?.name,
				mode: req.body?.mode,
				snapshot: req.body?.snapshot,
				user: req.body?.user,
				env: req.body?.env
					? Object.fromEntries(
							Object.keys(req.body?.env).map((key) => [key, MASKED_AUDIT_VALUE])
						)
					: undefined,
				secretEnv: req.body?.secretEnv?.map((binding) => ({
					name: binding.name,
					secretId: binding.secretId,
					version: binding.version,
				})),
				labels: req.body?.labels,
				placement: req.body?.placement,
				cpu: req.body?.cpu,
				gpu: req.body?.gpu,
				gpuType: req.body?.gpuType,
				memory: req.body?.memory,
				disk: req.body?.disk,
				autoStopInterval: req.body?.autoStopInterval,
				autoArchiveInterval: req.body?.autoArchiveInterval,
				autoDeleteInterval: req.body?.autoDeleteInterval,
				volumes: req.body?.volumes,
				buildInfo: req.body?.buildInfo,
				networkBlockAll: req.body?.networkBlockAll,
				networkAllowList: req.body?.networkAllowList,
				domainAllowList: req.body?.domainAllowList,
				egressBandwidthBps: req.body?.egressBandwidthBps,
				linkedSandbox: req.body?.linkedSandbox,
			}),
		},
	})
	async createSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() createSandboxDto: CreateSandboxDto,
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response
	): Promise<SandboxDto> {
		this.validateCreateVariant(createSandboxDto);
		await this.apiKeyBudgets.assertCreate(
			authContext,
			createSandboxDto,
			request.ip
		);
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
				routeTemplate: '/sandbox',
				fingerprintInput: createSandboxDto,
			},
			async (manager) => {
				const sandbox = createSandboxDto.buildInfo
					? await this.buildCreates.create(
							createSandboxDto,
							authContext.organizationId,
							authContext.principal,
							managedSecretsAllowed,
							request.ip,
							manager
						)
					: await this.snapshotCreates.create(
							createSandboxDto,
							authContext.organizationId,
							authContext.principal,
							managedSecretsAllowed,
							request.ip,
							manager
						);
				await attributeToApiKey(manager, sandbox, authContext.credential);
				return {
					body: SandboxDto.from(sandbox),
					status: HttpStatus.ACCEPTED,
					resource: { type: AuditTarget.SANDBOX, id: sandbox.id },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		}
		return result.body;
	}

	private validateCreateVariant(createSandboxDto: CreateSandboxDto): void {
		if (createSandboxDto.buildInfo) {
			if (createSandboxDto.snapshot) {
				throw new BadRequestException(
					apiError(
						SandboxErrorCode.SOURCE_INVALID,
						'Send either a snapshot or build info, not both. Remove the snapshot to build from build info.'
					)
				);
			}
			if (createSandboxDto.linkedSandbox) {
				throw new BadRequestException(
					apiError(
						SandboxErrorCode.SOURCE_INVALID,
						'linkedSandbox cannot be used with build info. Create the sandbox from a snapshot instead.'
					)
				);
			}
			return;
		}
		if (createSandboxDto.gpuType && createSandboxDto.gpuType.length > 0) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.SOURCE_INVALID,
					'A sandbox created from a snapshot uses the GPU type of the snapshot. Remove the GPU type from the request.'
				)
			);
		}
	}

	@Get(':sandboxIdOrName')
	@ApiOperation({
		summary: 'Get sandbox details',
		description:
			'Returns the sandbox with its current state. When the state is error or build_failed, errorReason explains why.',
		operationId: 'getSandbox',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiQuery({
		name: 'verbose',
		required: false,
		type: Boolean,
		description: 'Include verbose output',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Sandbox details',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredAnyOrganizationPermissions({
		sandboxes: ['read', 'write', 'delete'],
	})
	async getSandbox(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string
	): Promise<SandboxDto> {
		const sandbox = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			authContext.organizationId
		);

		return SandboxDto.from(sandbox);
	}

	@Get(':sandboxIdOrName/state-change')
	@ApiOperation({
		summary: 'Wait for the state of a sandbox to change',
		description:
			'Returns the sandbox as soon as its state differs from the observed state, or unchanged once the wait elapses.',
		operationId: 'awaitSandboxStateChange',
	})
	@ApiParam({
		name: 'sandboxIdOrName',
		description: 'ID or name of the sandbox',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Sandbox details',
		type: SandboxDto,
	})
	@UseGuards(SandboxAccessGuard)
	@RequiredAnyOrganizationPermissions({
		sandboxes: ['read', 'write', 'delete'],
	})
	async awaitSandboxStateChange(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('sandboxIdOrName') sandboxIdOrName: string,
		@Query() query: AwaitSandboxStateChangeQueryDto
	): Promise<SandboxDto> {
		const sandbox = await this.stateWaits.awaitChange(
			sandboxIdOrName,
			authContext.organizationId,
			query.observedState,
			query.waitSeconds
		);
		return SandboxDto.from(sandbox);
	}
}
