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
	NotFoundException,
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
import type { Request, Response } from 'express';
import {
	Audit,
	type TypedRequest,
} from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import {
	AdminCreditGrantDto,
	AdminGrantCreditDto,
} from '../../billing/dto/billing-credit-grant.dto';
import { BillingCreditGrantService } from '../../billing/services/billing-credit-grant.service';
import { CustomHeaders } from '../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../idempotency/services/api-idempotent-request.service';
import { CreateOrganizationQuotaDto } from '../../organization/dto/create-organization-quota.dto';
import { OrganizationLimitsDto } from '../../organization/dto/organization-limits.dto';
import { OrganizationQuotaDto } from '../../organization/dto/organization-quota.dto';
import { OrganizationSuspensionDto } from '../../organization/dto/organization-suspension.dto';
import { UpdateOrganizationLimitsDto } from '../../organization/dto/update-organization-limits.dto';
import { UpdateOrganizationQuotaDto } from '../../organization/dto/update-organization-quota.dto';
import { OrganizationLimitsService } from '../../organization/services/organization-limits.service';
import { OrganizationQuotaService } from '../../organization/services/organization-quota.service';
import { OrganizationSuspensionService } from '../../organization/services/organization-suspension.service';
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';
import {
	AdminOrganizationDto,
	AdminOrganizationListQueryDto,
	AdminOrganizationPageDto,
} from '../dto/admin-organization.dto';
import { OrganizationQuotaParamsDto } from '../dto/organization-quota-params.dto';
import { AdminOrganizationService } from '../services/admin-organization.service';

const REPLAYED = 'true';
const ORGANIZATION_ID_PARAM = {
	name: 'organizationId',
	description: 'Organization ID',
} as const;

const ORGANIZATION_TARGET = {
	targetType: AuditTarget.ORGANIZATION,
	targetIdFromRequest: (request: Request) => request.params.organizationId,
} as const;

const quotaAuditBody = (request: TypedRequest<UpdateOrganizationQuotaDto>) => ({
	sandboxClass: request.body?.sandboxClass,
	totalCpuQuota: request.body?.totalCpuQuota,
	totalMemoryQuota: request.body?.totalMemoryQuota,
	totalDiskQuota: request.body?.totalDiskQuota,
	totalGpuQuota: request.body?.totalGpuQuota,
	allowedGpuTypes: request.body?.allowedGpuTypes,
	maxCpuPerSandbox: request.body?.maxCpuPerSandbox,
	maxMemoryPerSandbox: request.body?.maxMemoryPerSandbox,
	maxDiskPerSandbox: request.body?.maxDiskPerSandbox,
	maxDiskPerNonEphemeralSandbox: request.body?.maxDiskPerNonEphemeralSandbox,
	maxCpuPerGpuSandbox: request.body?.maxCpuPerGpuSandbox,
	maxMemoryPerGpuSandbox: request.body?.maxMemoryPerGpuSandbox,
	maxDiskPerGpuSandbox: request.body?.maxDiskPerGpuSandbox,
});

@Controller('admin/organizations')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminOrganizationController {
	constructor(
		private readonly organizations: AdminOrganizationService,
		private readonly limits: OrganizationLimitsService,
		private readonly quotas: OrganizationQuotaService,
		private readonly suspensions: OrganizationSuspensionService,
		private readonly creditGrants: BillingCreditGrantService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Get()
	@ApiOperation({
		summary: 'List and search organizations',
		operationId: 'adminListOrganizations',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AdminOrganizationPageDto })
	list(
		@Query() query: AdminOrganizationListQueryDto
	): Promise<AdminOrganizationPageDto> {
		return this.organizations.list(query);
	}

	@Get(':organizationId')
	@ApiOperation({
		summary: 'Get an organization',
		operationId: 'adminGetOrganization',
	})
	@ApiParam(ORGANIZATION_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: AdminOrganizationDto })
	get(
		@Param('organizationId') organizationId: string
	): Promise<AdminOrganizationDto> {
		return this.organizations.get(organizationId);
	}

	@Get(':organizationId/limits')
	@ApiOperation({
		summary: 'Get the limits of an organization',
		operationId: 'adminGetOrganizationLimits',
	})
	@ApiParam(ORGANIZATION_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: OrganizationLimitsDto })
	async getLimits(
		@Param('organizationId') organizationId: string
	): Promise<OrganizationLimitsDto> {
		return OrganizationLimitsDto.from(await this.limits.get(organizationId));
	}

	@Patch(':organizationId/limits')
	@ApiOperation({
		summary: 'Update the limits of an organization',
		operationId: 'adminUpdateOrganizationLimits',
	})
	@ApiParam(ORGANIZATION_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: OrganizationLimitsDto })
	@Audit({
		action: AuditAction.UPDATE_QUOTA,
		...ORGANIZATION_TARGET,
		requestMetadata: {
			body: (request: TypedRequest<UpdateOrganizationLimitsDto>) => ({
				...request.body,
			}),
		},
	})
	async updateLimits(
		@Param('organizationId') organizationId: string,
		@Body() changes: UpdateOrganizationLimitsDto
	): Promise<OrganizationLimitsDto> {
		return OrganizationLimitsDto.from(
			await this.limits.update(organizationId, changes)
		);
	}

	@Get(':organizationId/quota')
	@ApiOperation({
		summary: 'List the quotas of an organization',
		operationId: 'adminListOrganizationQuotas',
	})
	@ApiParam(ORGANIZATION_ID_PARAM)
	@ApiResponse({ status: HttpStatus.OK, type: [OrganizationQuotaDto] })
	listQuotas(
		@Param('organizationId') organizationId: string
	): Promise<OrganizationQuotaDto[]> {
		return this.quotas.list(organizationId);
	}

	@Post(':organizationId/quota')
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a quota for an organization',
		operationId: 'adminCreateOrganizationQuota',
	})
	@ApiParam(ORGANIZATION_ID_PARAM)
	@ApiResponse({ status: HttpStatus.CREATED, type: OrganizationQuotaDto })
	@Audit({
		action: AuditAction.CREATE_ORGANIZATION_QUOTA,
		...ORGANIZATION_TARGET,
		requestMetadata: {
			body: (request: TypedRequest<CreateOrganizationQuotaDto>) =>
				quotaAuditBody(request),
		},
	})
	createQuota(
		@Param('organizationId') organizationId: string,
		@Body() createDto: CreateOrganizationQuotaDto
	): Promise<OrganizationQuotaDto> {
		return this.quotas.create(organizationId, createDto);
	}

	@Get(':organizationId/quota/:sandboxClass')
	@ApiOperation({
		summary: 'Get a quota of an organization',
		operationId: 'adminGetOrganizationQuota',
	})
	@ApiResponse({ status: HttpStatus.OK, type: OrganizationQuotaDto })
	async getQuota(
		@Param() params: OrganizationQuotaParamsDto
	): Promise<OrganizationQuotaDto> {
		const quota = await this.quotas.find(
			params.organizationId,
			params.sandboxClass
		);
		if (!quota) {
			throw new NotFoundException(
				`Quota for organization ${params.organizationId}, sandbox class ${params.sandboxClass} not found`
			);
		}
		return quota;
	}

	@Patch(':organizationId/quota')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Update a quota of an organization',
		operationId: 'adminUpdateOrganizationQuota',
	})
	@ApiParam(ORGANIZATION_ID_PARAM)
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@Audit({
		action: AuditAction.UPDATE_ORGANIZATION_QUOTA,
		...ORGANIZATION_TARGET,
		requestMetadata: { body: quotaAuditBody },
	})
	async updateQuota(
		@Param('organizationId') organizationId: string,
		@Body() updateDto: UpdateOrganizationQuotaDto
	): Promise<void> {
		await this.quotas.update(organizationId, updateDto);
	}

	@Delete(':organizationId/quota/:sandboxClass')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Delete a quota of an organization',
		operationId: 'adminDeleteOrganizationQuota',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@Audit({
		action: AuditAction.DELETE_ORGANIZATION_QUOTA,
		...ORGANIZATION_TARGET,
		requestMetadata: {
			params: (request) => ({ sandboxClass: request.params.sandboxClass }),
		},
	})
	async deleteQuota(
		@Param() params: OrganizationQuotaParamsDto
	): Promise<void> {
		await this.quotas.delete(params.organizationId, params.sandboxClass);
	}

	@Post(':organizationId/suspend')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Suspend an organization',
		operationId: 'adminSuspendOrganization',
	})
	@ApiParam(ORGANIZATION_ID_PARAM)
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@Audit({
		action: AuditAction.SUSPEND,
		...ORGANIZATION_TARGET,
		requestMetadata: {
			body: (request: TypedRequest<OrganizationSuspensionDto>) => ({
				...request.body,
			}),
		},
	})
	async suspend(
		@Param('organizationId') organizationId: string,
		@Body() suspension: OrganizationSuspensionDto
	): Promise<void> {
		await this.suspensions.suspend(organizationId, suspension);
	}

	@Post(':organizationId/unsuspend')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Lift the suspension of an organization',
		operationId: 'adminUnsuspendOrganization',
	})
	@ApiParam(ORGANIZATION_ID_PARAM)
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@Audit({ action: AuditAction.UNSUSPEND, ...ORGANIZATION_TARGET })
	async unsuspend(
		@Param('organizationId') organizationId: string
	): Promise<void> {
		await this.suspensions.unsuspend(organizationId);
	}

	@Post(':organizationId/credit-grants')
	@HttpCode(HttpStatus.CREATED)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Grant customer credit to an organization',
		operationId: 'adminGrantOrganizationCredit',
	})
	@ApiParam(ORGANIZATION_ID_PARAM)
	@ApiResponse({ status: HttpStatus.CREATED, type: AdminCreditGrantDto })
	@Audit({
		action: AuditAction.GRANT_CREDIT,
		...ORGANIZATION_TARGET,
		requestMetadata: {
			body: (request: TypedRequest<AdminGrantCreditDto>) => ({
				amountMicroUsd: request.body?.amountMicroUsd,
				reason: request.body?.reason,
			}),
		},
	})
	async grantCredit(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Param('organizationId') organizationId: string,
		@Body() input: AdminGrantCreditDto,
		@Res({ passthrough: true }) response: Response
	): Promise<AdminCreditGrantDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: context.organizationId,
				principal: context.principal,
				method: 'POST',
				routeTemplate: '/admin/organizations/:organizationId/credit-grants',
				fingerprintInput: { organizationId, ...input },
			},
			async (manager) => {
				const body = await this.creditGrants.grant(manager, {
					organizationId,
					amountMicroUsd: input.amountMicroUsd,
					reason: input.reason,
					actorUserId: context.userId,
				});
				return {
					body,
					status: HttpStatus.CREATED,
					resource: { type: AuditTarget.ORGANIZATION, id: organizationId },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, REPLAYED);
		}
		return result.body;
	}
}
