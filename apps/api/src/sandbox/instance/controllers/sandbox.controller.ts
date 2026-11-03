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
import { ApiPlacementConflictResponse } from '../decorators/api-placement-conflict-response.decorator';
import { CreateSandboxDto } from '../dto/create-sandbox.dto';
import { ListSandboxesQueryDto } from '../dto/list-sandboxes-query.dto';
import { ListSandboxesResponseDto } from '../dto/list-sandboxes-response.dto';
import { SandboxDto } from '../dto/sandbox.dto';
import {
	BillingRestrictedErrorDto,
	MachineUnavailableErrorDto,
	PriceChangedErrorDto,
} from '../dto/sandbox-placement-error.dto';
import {
	SandboxQuoteDto,
	SandboxQuoteRequestDto,
} from '../dto/sandbox-quote.dto';
import { AwaitSandboxStateChangeQueryDto } from '../dto/sandbox-state-change.dto';
import type { Sandbox } from '../entities/sandbox.entity';
import { SandboxAccessGuard } from '../guards/sandbox-access.guard';
import { SandboxQuoteService } from '../services/admission/sandbox-quote.service';
import { SandboxBuildCreateService } from '../services/lifecycle/sandbox-build-create.service';
import { SandboxCreateNotifier } from '../services/lifecycle/sandbox-create-notifier.service';
import { SandboxSnapshotCreateService } from '../services/lifecycle/sandbox-snapshot-create.service';
import { SandboxService } from '../services/sandbox/sandbox.service';
import { SandboxSearchService } from '../services/sandbox/sandbox-search.service';
import { SandboxStateWaitService } from '../services/sandbox/sandbox-state-wait.service';
import { canUseManagedSecrets } from '../utils/runtime/managed-secrets-permission.util';

@Controller('sandbox')
@ApiTags('sandbox')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class SandboxController {
	constructor(
		private readonly sandboxService: SandboxService,
		private readonly quotes: SandboxQuoteService,
		private readonly search: SandboxSearchService,
		private readonly snapshotCreates: SandboxSnapshotCreateService,
		private readonly buildCreates: SandboxBuildCreateService,
		private readonly createNotifier: SandboxCreateNotifier,
		private readonly idempotency: ApiIdempotentRequestService,
		private readonly organizationAccess: OrganizationAccessService,
		private readonly stateWaits: SandboxStateWaitService
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
		description: 'Advanced filtering and ordering. Eventually consistent.',
		operationId: 'listSandboxes',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: ListSandboxesResponseDto,
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
			'Accepts sandbox creation and returns its durable lifecycle resource immediately. Poll the returned sandbox ID or subscribe to sandbox updates until observed state reaches the requested state.',
		operationId: 'createSandbox',
	})
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Sandbox creation was durably accepted.',
		type: SandboxDto,
	})
	@ApiPlacementConflictResponse(
		MachineUnavailableErrorDto,
		PriceChangedErrorDto,
		BillingRestrictedErrorDto
	)
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
		const managedSecretsAllowed = await canUseManagedSecrets(
			this.organizationAccess,
			authContext
		);
		let created: Sandbox | undefined;
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
				created = sandbox;
				return {
					body: SandboxDto.from(sandbox),
					status: HttpStatus.ACCEPTED,
					resource: { type: AuditTarget.SANDBOX, id: sandbox.id },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		} else if (created) {
			this.createNotifier.notifyCreated(created);
		}
		return result.body;
	}

	private validateCreateVariant(createSandboxDto: CreateSandboxDto): void {
		if (createSandboxDto.buildInfo) {
			if (createSandboxDto.snapshot) {
				throw new BadRequestException(
					'Cannot specify a snapshot when using a build info entry'
				);
			}
			if (createSandboxDto.linkedSandbox) {
				throw new BadRequestException(
					'linkedSandbox is not supported with declarative builds. Create a sandbox from a snapshot'
				);
			}
			return;
		}
		if (createSandboxDto.gpuType && createSandboxDto.gpuType.length > 0) {
			throw new BadRequestException(
				'Cannot specify GPU type when creating sandbox from snapshot. GPU type is inherited from snapshot.'
			);
		}
	}

	@Get(':sandboxIdOrName')
	@ApiOperation({
		summary: 'Get sandbox details',
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
