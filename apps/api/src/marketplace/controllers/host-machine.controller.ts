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
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	Res,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiExtraModels,
	ApiHeader,
	ApiOperation,
	ApiResponse,
	ApiTags,
	getSchemaPath,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
	Audit,
	type TypedRequest,
} from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { CustomHeaders } from '../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { CursorPageQueryDto } from '../../common/dto/cursor-page.dto';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../idempotency/services/api-idempotent-request.service';
import { parseRequiredResourceVersion } from '../../infra/database/utils/resource-version.util';
import { RequiredOrganizationPermissions } from '../../organization/decorators/required-organization-permissions.decorator';
import { MARKETPLACE_ROUTE } from '../constants/marketplace.constants';
import {
	HostMachineDto,
	HostMachineListingDto,
	HostMachinePageDto,
	UpdateMachineListingDto,
} from '../dto/host-machine.dto';
import {
	CreatePriceCardDto,
	PriceCardDto,
	PriceCardPageDto,
} from '../dto/price-card.dto';
import {
	PriceAboveCeilingErrorDto,
	PriceBelowFloorErrorDto,
} from '../dto/price-card-error.dto';
import { PriceFloorDto } from '../dto/price-floor.dto';
import { HostMachineService } from '../services/host-machine.service';
import { MachineListingService } from '../services/machine-listing.service';
import { PriceCardService } from '../services/price-card.service';
import { PriceFloorService } from '../services/price-floor.service';

const IF_MATCH_HEADER = 'if-match';
const IDEMPOTENCY_REPLAYED = 'true';
const MACHINE_TARGET = (request: Request) => request.params.machineId;

@Controller(MARKETPLACE_ROUTE.HOST_MACHINES)
@ApiTags('machines')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class HostMachineController {
	constructor(
		private readonly hostMachines: HostMachineService,
		private readonly listings: MachineListingService,
		private readonly priceCards: PriceCardService,
		private readonly floors: PriceFloorService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Get()
	@ApiOperation({
		summary: 'List the machines the organization hosts',
		operationId: 'listHostMachines',
	})
	@ApiResponse({ status: HttpStatus.OK, type: HostMachinePageDto })
	@RequiredOrganizationPermissions({ listings: ['read'] })
	listHostMachines(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Query() query: CursorPageQueryDto
	): Promise<HostMachinePageDto> {
		return this.hostMachines.list(
			context.organizationId,
			query.limit,
			query.cursor
		);
	}

	@Get(':machineId')
	@ApiOperation({
		summary: 'Get a machine the organization hosts',
		operationId: 'getHostMachine',
	})
	@ApiResponse({ status: HttpStatus.OK, type: HostMachineDto })
	@RequiredOrganizationPermissions({ listings: ['read'] })
	getHostMachine(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string
	): Promise<HostMachineDto> {
		return this.hostMachines.get(context.organizationId, machineId);
	}

	@Put(':machineId/listing')
	@ApiOperation({
		summary: 'Change the listing state and visibility of a machine',
		operationId: 'updateMachineListing',
	})
	@ApiHeader({
		name: IF_MATCH_HEADER,
		description: 'The listing version the change is based on',
		required: true,
	})
	@ApiResponse({ status: HttpStatus.OK, type: HostMachineListingDto })
	@RequiredOrganizationPermissions({ listings: ['write'] })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: MACHINE_TARGET,
		requestMetadata: {
			body: (request: TypedRequest<UpdateMachineListingDto>) => ({
				state: request.body.state,
				visibility: request.body.visibility,
			}),
		},
	})
	async updateMachineListing(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string,
		@Headers(IF_MATCH_HEADER) ifMatch: string | undefined,
		@Body() input: UpdateMachineListingDto
	): Promise<HostMachineListingDto> {
		const listing = await this.listings.update(
			context.organizationId,
			machineId,
			parseRequiredResourceVersion(ifMatch),
			input
		);
		return HostMachineListingDto.from(listing);
	}

	@Get(':machineId/price-cards')
	@ApiOperation({
		summary: 'List the immutable price cards of a machine',
		operationId: 'listMachinePriceCards',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PriceCardPageDto })
	@RequiredOrganizationPermissions({ listings: ['read'] })
	listMachinePriceCards(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string,
		@Query() query: CursorPageQueryDto
	): Promise<PriceCardPageDto> {
		return this.priceCards.list(
			context.organizationId,
			machineId,
			query.limit,
			query.cursor
		);
	}

	@Post(':machineId/price-cards')
	@HttpCode(HttpStatus.CREATED)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Publish a new price card and make it current',
		operationId: 'createMachinePriceCard',
	})
	@ApiResponse({ status: HttpStatus.CREATED, type: PriceCardDto })
	@ApiExtraModels(PriceBelowFloorErrorDto, PriceAboveCeilingErrorDto)
	@ApiResponse({
		status: HttpStatus.UNPROCESSABLE_ENTITY,
		description:
			'The price card is below the market floor or its egress price is above the ceiling',
		schema: {
			oneOf: [
				{ $ref: getSchemaPath(PriceBelowFloorErrorDto) },
				{ $ref: getSchemaPath(PriceAboveCeilingErrorDto) },
			],
		},
	})
	@RequiredOrganizationPermissions({ listings: ['write'] })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.MACHINE,
		targetIdFromRequest: MACHINE_TARGET,
		requestMetadata: {
			body: (request: TypedRequest<CreatePriceCardDto>) => ({
				...request.body,
			}),
		},
		resultMetadata: {
			priceCardId: (result: PriceCardDto) => result.id,
			version: (result: PriceCardDto) => result.version,
		},
	})
	async createMachinePriceCard(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() input: CreatePriceCardDto,
		@Res({ passthrough: true }) response: Response
	): Promise<PriceCardDto> {
		const result = await this.idempotency.execute(
			{
				key,
				organizationId: context.organizationId,
				principal: context.principal,
				method: 'POST',
				routeTemplate: MARKETPLACE_ROUTE.MACHINE_PRICE_CARDS,
				fingerprintInput: { machineId, ...input },
			},
			async (manager) => ({
				body: PriceCardDto.from(
					await this.priceCards.create(
						manager,
						context.organizationId,
						machineId,
						input,
						context.userId
					)
				),
				status: HttpStatus.CREATED,
				resource: { type: AuditTarget.MACHINE, id: machineId },
			})
		);
		if (result.replayed) {
			response.setHeader(
				CustomHeaders.IDEMPOTENCY_REPLAYED.name,
				IDEMPOTENCY_REPLAYED
			);
		}
		return result.body;
	}

	@Get(':machineId/price-floor')
	@ApiOperation({
		summary: 'Get the market price floor for a machine',
		operationId: 'getMachinePriceFloor',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PriceFloorDto })
	@RequiredOrganizationPermissions({ listings: ['read'] })
	getMachinePriceFloor(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('machineId', ParseUUIDPipe) machineId: string
	): Promise<PriceFloorDto> {
		return this.floors.machineFloor(context.organizationId, machineId);
	}
}
